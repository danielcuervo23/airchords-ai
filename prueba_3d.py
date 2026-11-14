"""
prueba_filtro_3d.py

Filtro facial 3D (estilo TikTok/Snapchat) que ancla un modelo GLB
(Spider-Man) a la cabeza real usando head pose 3D verdadero.

DISEÑO
------
En vez de FaceMesh legado + solvePnP con un puñado de puntos, usamos
la Face Landmarker API moderna de MediaPipe con
output_facial_transformation_matrixes=True. Por frame, MediaPipe
entrega una matriz 4x4 que ya representa rotacion + traslacion +
anclaje al centro real de la cabeza, en un espacio metrico (cm)
disenado para usarse DIRECTAMENTE como matriz de modelo en una
camara tipo OpenGL/pyrender:

    - camara en el origen, mirando hacia -Z
    - +Y hacia arriba, +X hacia la derecha  (igual que pyrender)
    - FOV vertical fijo: 63 grados
    - near = 1 cm, far = 10000 cm

(estos valores son los que usa internamente el pipeline
face_geometry de MediaPipe: FaceGeometryEnvGeneratorCalculator).

Por eso, si construimos la camara de pyrender con ESOS MISMOS
parametros, la matriz de MediaPipe encaja sin ninguna conversion
OpenCV<->OpenGL y sin necesitar los intrinsecos reales de la webcam.

El modelo GLB fue creado en su propio espacio local, sin relacion
con el "rostro canonico" de MediaPipe. Por eso existe un unico
BIND_TRANSFORM (escala + rotacion + traslacion) que se calibra UNA
SOLA VEZ con el modo interactivo (tecla 'c') y luego queda fijo:

    pose_final = matriz_cabeza_mediapipe @ BIND_TRANSFORM

Ese orden es la clave: primero se lleva el modelo de su espacio
local al espacio del rostro canonico (BIND_TRANSFORM), y luego se
aplica la pose real de la cabeza en ese frame, que mueve/rota/escala
todo el conjunto (cara + cuello) como un solo cuerpo rigido.

Ademas, la matriz de MediaPipe puede temblar levemente de un frame a
otro (jitter). Se suaviza con un promedio exponencial: la rotacion
se promedia y se reproyecta a la rotacion valida mas cercana via SVD
(promediar matrices de rotacion directamente no da otra rotacion
valida, por eso el reproyectado), y la traslacion se promedia lineal.

CONTROLES
---------
    c          alterna modo CALIBRACION (cabeza congelada de frente,
               con una guia ovalada de referencia sobre la imagen)
    flechas    mover el bind pose en X/Y (paso normal)
    W/S/A/D/Q/E/Z/X (mayusculas)  version FINA (paso pequeno) de:
               escala / yaw / pitch / roll
    w / s      escala del bind pose (paso normal)
    a / d      yaw del bind pose  (grados, paso normal)
    q / e      pitch del bind pose (grados, paso normal)
    z / x      roll del bind pose (grados, paso normal)
    r / f      traslacion en Z del bind pose (profundidad / cuello)
    p          imprime en consola los valores actuales de BIND_*
               (para copiarlos y dejarlos fijos arriba del script)
    ESC        salir
"""

import os
import time
import urllib.request

import cv2
import numpy as np
import trimesh
import pyrender

import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision as mp_vision


# ============================================================
# CONFIGURACION GENERAL
# ============================================================

ANCHO = 640
ALTO = 480

RUTA_GLB = "Filtros/source/spiderman.glb"
RUTA_MODELO_TASK = "face_landmarker.task"
URL_MODELO_TASK = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)

# Camara virtual: DEBE coincidir con la que usa MediaPipe
# internamente para calcular facial_transformation_matrixes.
# (mediapipe/modules/face_geometry, PerspectiveCamera por defecto)
FOV_VERTICAL_GRADOS = 63.0
CAM_NEAR = 1.0        # 1 cm
CAM_FAR = 10000.0     # 100 m


# ============================================================
# BIND POSE DEL MODELO (calibracion del asset — se define UNA VEZ)
# ============================================================
# Punto de partida razonable: el modelo, tras dump(concatenate=True),
# se normaliza a una caja de 2 unidades (ver mas abajo), y una
# cabeza+mascara real ronda los 18-22 cm de ancho. Ajusta estos
# valores con el modo de calibracion (tecla 'c') y despues pegalos
# aqui definitivos.

BIND_ESCALA = 20.0                          # unidades modelo -> cm
BIND_TRASLACION = np.array([0.0, 2.5, -1.5])   # cm  (x, y, z)
BIND_ROTACION_GRADOS = np.array([0.0, 0.0, 0.0])  # grados (pitch, yaw, roll)


# ============================================================
# DESCARGA DEL MODELO .task SI NO EXISTE
# ============================================================

def asegurar_modelo_task():
    if not os.path.exists(RUTA_MODELO_TASK):
        print("Descargando face_landmarker.task ...")
        urllib.request.urlretrieve(URL_MODELO_TASK, RUTA_MODELO_TASK)
        print("Descarga completa.")


# ============================================================
# UTILIDADES DE TRANSFORMACION
# ============================================================

def matriz_rotacion_grados(pitch_yaw_roll):
    """Rotacion XYZ (grados) -> matriz 3x3, orden Rz @ Ry @ Rx."""
    rx, ry, rz = np.radians(pitch_yaw_roll)

    Rx = np.array([
        [1, 0, 0],
        [0, np.cos(rx), -np.sin(rx)],
        [0, np.sin(rx), np.cos(rx)],
    ])

    Ry = np.array([
        [np.cos(ry), 0, np.sin(ry)],
        [0, 1, 0],
        [-np.sin(ry), 0, np.cos(ry)],
    ])

    Rz = np.array([
        [np.cos(rz), -np.sin(rz), 0],
        [np.sin(rz), np.cos(rz), 0],
        [0, 0, 1],
    ])

    return Rz @ Ry @ Rx


def construir_bind_transform(escala, traslacion, rotacion_grados):
    """Escala + rotacion + traslacion del modelo -> espacio del rostro canonico."""
    T = np.eye(4)
    T[:3, :3] = matriz_rotacion_grados(rotacion_grados) * escala
    T[:3, 3] = traslacion
    return T


def matriz_camara_pyrender():
    """Camara identica a la que MediaPipe asume para calcular la pose."""
    return pyrender.PerspectiveCamera(
        yfov=np.radians(FOV_VERTICAL_GRADOS),
        aspectRatio=ANCHO / ALTO,
        znear=CAM_NEAR,
        zfar=CAM_FAR,
    )


def suavizar_matriz_cabeza(matriz_nueva, estado, alpha=0.55):
    """
    Suavizado temporal de la pose de cabeza para reducir jitter.

    - Traslacion: promedio exponencial simple.
    - Rotacion: se promedia la matriz 3x3 y se reproyecta a la
      rotacion valida mas cercana con SVD (R = U @ Vt). Promediar
      matrices de rotacion directamente NO da otra matriz de
      rotacion valida (no es ortonormal en general); la
      reproyeccion via SVD es la forma estandar y barata de
      corregir eso sin necesitar cuaterniones/slerp.

    `estado` es un dict mutable que persiste entre frames
    (`{"pose": None}` al arrancar).
    """
    if estado["pose"] is None:
        estado["pose"] = matriz_nueva.copy()
        return estado["pose"]

    anterior = estado["pose"]

    R_prom = alpha * anterior[:3, :3] + (1 - alpha) * matriz_nueva[:3, :3]
    U, _S, Vt = np.linalg.svd(R_prom)
    R_suave = U @ Vt

    t_suave = alpha * anterior[:3, 3] + (1 - alpha) * matriz_nueva[:3, 3]

    suave = np.eye(4)
    suave[:3, :3] = R_suave
    suave[:3, 3] = t_suave

    estado["pose"] = suave
    return suave


# ============================================================
# CARGA DEL MODELO GLB (conservando texturas originales)
# ============================================================

def cargar_modelo_glb(ruta):
    print("Cargando modelo GLB...")

    escena_glb = trimesh.load(ruta, force="scene")
    malla = escena_glb.dump(concatenate=True)

    # Centrar en el propio centroide del modelo: esto es una
    # normalizacion legitima del asset, no un offset arbitrario.
    centro = malla.bounding_box.centroid
    malla.apply_translation(-centro)

    # Normalizar a una caja de 2 unidades: hace que BIND_ESCALA
    # sea independiente de las unidades originales del .glb.
    tamano = max(malla.extents)
    malla.apply_scale(2.0 / tamano)

    print("Modelo cargado correctamente.")
    return pyrender.Mesh.from_trimesh(malla, smooth=True)


# ============================================================
# ESCENA
# ============================================================

def crear_escena(mesh_3d, pose_mesh):
    escena = pyrender.Scene(bg_color=[0, 0, 0, 0], ambient_light=[0.45, 0.45, 0.45])

    luz1 = pyrender.DirectionalLight(color=np.ones(3), intensity=3.0)
    escena.add(luz1, pose=np.array([
        [1, 0, 0, 20],
        [0, 1, 0, 20],
        [0, 0, 1, 40],
        [0, 0, 0, 1],
    ], dtype=np.float64))

    luz2 = pyrender.DirectionalLight(color=np.ones(3), intensity=2.0)
    escena.add(luz2, pose=np.array([
        [1, 0, 0, -20],
        [0, 1, 0, 20],
        [0, 0, 1, 30],
        [0, 0, 0, 1],
    ], dtype=np.float64))

    # La camara de pyrender queda en el origen mirando hacia -Z,
    # exactamente lo que asume MediaPipe: pose = identidad.
    escena.add(matriz_camara_pyrender(), pose=np.eye(4))

    escena.add(mesh_3d, pose=pose_mesh)

    return escena


# ============================================================
# GUIA VISUAL DE CALIBRACION
# ============================================================

def dibujar_guia_calibracion(frame):
    """
    Ovalo de referencia con las proporciones promedio de una cabeza
    centrada de frente en el encuadre. Sirve para calibrar escala y
    posicion del bind pose sin tener que adivinar "a ojo" contra tu
    propia cara (que puede estar en un angulo o distancia distinta
    cada vez que abres el modo calibracion).
    """
    centro = (ANCHO // 2, int(ALTO * 0.48))
    ejes = (int(ANCHO * 0.19), int(ALTO * 0.34))

    overlay = frame.copy()
    cv2.ellipse(overlay, centro, ejes, 0, 0, 360, (0, 255, 255), 2)
    cv2.line(
        overlay,
        (centro[0], centro[1] - ejes[1]),
        (centro[0], centro[1] + ejes[1]),
        (0, 255, 255), 1,
    )
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, dst=frame)
    return frame


# ============================================================
# MAIN
# ============================================================

def main():
    global BIND_ESCALA, BIND_TRASLACION, BIND_ROTACION_GRADOS

    asegurar_modelo_task()
    mesh_3d = cargar_modelo_glb(RUTA_GLB)

    renderer = pyrender.OffscreenRenderer(viewport_width=ANCHO, viewport_height=ALTO)

    opciones = mp_vision.FaceLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=RUTA_MODELO_TASK),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=True,
    )
    landmarker = mp_vision.FaceLandmarker.create_from_options(opciones)

    cap = cv2.VideoCapture(1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, ANCHO)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, ALTO)

    modo_calibracion = False
    t_inicio = time.time()
    estado_suavizado = {"pose": None}

    print("\nListo. 'c' = calibrar, 'p' = imprimir valores, ESC = salir.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_imagen = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int((time.time() - t_inicio) * 1000)
        resultado = landmarker.detect_for_video(mp_imagen, timestamp_ms)

        bind_transform = construir_bind_transform(
            BIND_ESCALA, BIND_TRASLACION, BIND_ROTACION_GRADOS
        )

        pose_final = None

        if modo_calibracion:
            # Cabeza "congelada" de frente: solo vemos el efecto
            # del bind pose, para calibrarlo visualmente.
            pose_final = bind_transform

        elif resultado.facial_transformation_matrixes:
            matriz_cabeza = np.array(
                resultado.facial_transformation_matrixes[0], dtype=np.float64
            ).reshape(4, 4)

            matriz_cabeza = suavizar_matriz_cabeza(matriz_cabeza, estado_suavizado)

            pose_final = matriz_cabeza @ bind_transform
        else:
            # Se perdio la deteccion: reinicia el suavizado para que
            # no "arrastre" una pose vieja cuando la cara reaparezca.
            estado_suavizado["pose"] = None

        if pose_final is not None:
            escena = crear_escena(mesh_3d, pose_final)
            color, profundidad = renderer.render(escena)

            # No usamos el canal alfa del material (algunos texturas
            # del GLB, como el borde negro, traen su propio canal
            # alfa de "BLEND"/"MASK" y quedan semitransparentes aunque
            # ahi SI hay geometria — eso dejaba ver la cara real
            # detras). En vez de eso: cualquier pixel donde pyrender
            # haya dibujado algo (profundidad > 0) es 100% opaco.
            # Solo el fondo real (sin geometria) queda transparente.
            alpha = (profundidad > 0).astype(np.float32)
            alpha = cv2.GaussianBlur(alpha, (3, 3), 0)[..., np.newaxis]

            bgr_render = cv2.cvtColor(color, cv2.COLOR_RGB2BGR)

            frame = (
                bgr_render.astype(np.float32) * alpha
                + frame.astype(np.float32) * (1 - alpha)
            ).astype(np.uint8)

        if modo_calibracion:
            frame = dibujar_guia_calibracion(frame)
            cv2.putText(
                frame, "MODO CALIBRACION (tecla 'c' para salir)",
                (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2
            )
            cv2.putText(
                frame,
                f"escala={BIND_ESCALA:.2f}  "
                f"traslacion={np.round(BIND_TRASLACION, 2).tolist()}  "
                f"rot={np.round(BIND_ROTACION_GRADOS, 1).tolist()}",
                (10, ALTO - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1
            )

        cv2.imshow("Spider-Man 3D", frame)

        tecla = cv2.waitKey(1) & 0xFF

        if tecla == 27:                       # ESC
            break
        elif tecla == ord('c'):
            modo_calibracion = not modo_calibracion
        # --- pasos normales ---
        elif tecla == ord('w'):
            BIND_ESCALA *= 1.02
        elif tecla == ord('s'):
            BIND_ESCALA /= 1.02
        elif tecla == ord('a'):
            BIND_ROTACION_GRADOS[1] -= 1.0
        elif tecla == ord('d'):
            BIND_ROTACION_GRADOS[1] += 1.0
        elif tecla == ord('q'):
            BIND_ROTACION_GRADOS[0] -= 1.0
        elif tecla == ord('e'):
            BIND_ROTACION_GRADOS[0] += 1.0
        elif tecla == ord('z'):
            BIND_ROTACION_GRADOS[2] -= 1.0
        elif tecla == ord('x'):
            BIND_ROTACION_GRADOS[2] += 1.0
        elif tecla == ord('r'):
            BIND_TRASLACION[2] += 0.2
        elif tecla == ord('f'):
            BIND_TRASLACION[2] -= 0.2
        elif tecla == 82:   # flecha arriba
            BIND_TRASLACION[1] += 0.2
        elif tecla == 84:   # flecha abajo
            BIND_TRASLACION[1] -= 0.2
        elif tecla == 81:   # flecha izquierda
            BIND_TRASLACION[0] -= 0.2
        elif tecla == 83:   # flecha derecha
            BIND_TRASLACION[0] += 0.2
        # --- pasos finos (mayusculas, ~1/8 del paso normal) ---
        elif tecla == ord('W'):
            BIND_ESCALA *= 1.0025
        elif tecla == ord('S'):
            BIND_ESCALA /= 1.0025
        elif tecla == ord('A'):
            BIND_ROTACION_GRADOS[1] -= 0.125
        elif tecla == ord('D'):
            BIND_ROTACION_GRADOS[1] += 0.125
        elif tecla == ord('Q'):
            BIND_ROTACION_GRADOS[0] -= 0.125
        elif tecla == ord('E'):
            BIND_ROTACION_GRADOS[0] += 0.125
        elif tecla == ord('Z'):
            BIND_ROTACION_GRADOS[2] -= 0.125
        elif tecla == ord('X'):
            BIND_ROTACION_GRADOS[2] += 0.125
        elif tecla == ord('p'):
            print("\nBIND_ESCALA =", BIND_ESCALA)
            print("BIND_TRASLACION = np.array(", list(np.round(BIND_TRASLACION, 3)), ")")
            print("BIND_ROTACION_GRADOS = np.array(", list(np.round(BIND_ROTACION_GRADOS, 1)), ")\n")

    cap.release()
    renderer.delete()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()