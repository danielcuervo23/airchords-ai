"""
PianoVirtual.py

Piano / Guitarra / Violín tocados con las manos (MediaPipe Hands),
cambio de instrumento abriendo la boca, y filtro facial 3D de
Spider-Man (MediaPipe FaceLandmarker + pyrender) anclado con head
pose real, todo en un solo bucle sobre una sola cámara.

NOTA DE DISEÑO IMPORTANTE:
En vez de correr FaceMesh (legado) para la malla/boca Y FaceLandmarker
(Tasks) para la pose 3D -dos detectores de cara por frame-, se usa
SOLO FaceLandmarker: ya entrega los mismos 468 landmarks (misma
indexación que FaceMesh legado) además de la matriz de transformación
para el filtro 3D. Esto elimina un modelo completo del bucle.
"""

import os
import sys
import time
import urllib.request

import cv2
import numpy as np
import pygame
import trimesh
import pyrender

import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.python.solutions.drawing_utils import draw_landmarks


# ============================================================
# CONFIGURACION GENERAL
# ============================================================

RUTA_GLB = "Filtros/source/spiderman.glb"
RUTA_MODELO_TASK = "face_landmarker.task"
URL_MODELO_TASK = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)

# Camara virtual del filtro 3D: DEBE coincidir con la que usa
# MediaPipe internamente para calcular facial_transformation_matrixes.
FOV_VERTICAL_GRADOS = 63.0
CAM_NEAR = 1.0
CAM_FAR = 10000.0

# Bind pose del modelo GLB (calibrado con prueba_filtro_3d.py, modo
# 'c'). Si vuelves a calibrar y obtienes otros valores, reemplazalos
# aqui.
BIND_ESCALA = 22.373248385280002
BIND_TRASLACION = np.array([0.0, 2.5, -1.5])
BIND_ROTACION_GRADOS = np.array([0.0, 0.0, 0.0])

notas = [
    "A3_La.wav",
    "B3_Si.wav",
    "C4_Do.wav",
    "E4_Mi.wav",
    "F4_Fa.wav",
    "G4_Sol.wav",
]

instrument_names = ["PIANO", "GUITARRA", "VIOLIN"]
instrument_folders = ["Piano", "Guitarra", "Violin"]


# ============================================================
# SONIDOS
# ============================================================

def cargar_sonidos():
    pygame.mixer.init()
    pygame.mixer.set_num_channels(6)

    canales = [pygame.mixer.Channel(i) for i in range(6)]

    sonidos_por_instrumento = []

    try:
        for carpeta in instrument_folders:
            sonidos = []
            for nota in notas:
                sonidos.append(pygame.mixer.Sound(carpeta + "/" + nota))
            sonidos_por_instrumento.append(sonidos)
    except FileNotFoundError as error:
        print(f"[ERROR] No se encontro un archivo de sonido: {error}")
        sys.exit(1)

    return canales, sonidos_por_instrumento


# ============================================================
# DETECCION DE DEDOS Y BOCA  (sin cambios respecto al original)
# ============================================================

def is_finger_down(landmarks, finger):
    if finger == 0:
        tip, pip = landmarks[8], landmarks[6]
    elif finger == 1:
        tip, pip = landmarks[12], landmarks[10]
    else:
        tip, pip = landmarks[16], landmarks[14]

    return tip.y > pip.y + 0.008


def is_pinky_up(landmarks):
    """
    Meñique levantado (landmarks 20=punta, 18=nudillo). No se usa
    para ninguna nota (esas usan indice/medio/anular), asi que sirve
    como gesto libre para el toggle de la mascara sin chocar con
    tocar el instrumento.
    """
    tip = landmarks[20]
    pip = landmarks[18]
    return tip.y < pip.y - 0.02


def mouth_open(landmarks):
    upper_lip = landmarks[13]
    lower_lip = landmarks[14]
    left_corner = landmarks[61]
    right_corner = landmarks[291]

    apertura = abs(lower_lip.y - upper_lip.y)
    ancho = abs(right_corner.x - left_corner.x)

    if ancho == 0:
        return 0

    return apertura / ancho


# ============================================================
# FILTRO 3D — utilidades de transformacion
# (identicas a prueba_filtro_3d.py, ya corregidas y validadas)
# ============================================================

def asegurar_modelo_task():
    """
    Descarga el modelo si falta y devuelve su contenido en bytes.

    En Windows, mediapipe.tasks tiene un bug conocido resolviendo
    model_asset_path: su logica interna espera que una ruta absoluta
    empiece con '/' (estilo Unix); una ruta de Windows como
    'C:/Users/...' no cumple eso, asi que la trata como relativa y la
    concatena mal con la carpeta interna del paquete (site-packages),
    fallando con "Unable to open file" sin importar el formato de la
    ruta que le pasemos. La forma robusta de evitarlo es no pasarle
    ninguna ruta: leer el .task en memoria y pasarlo como bytes via
    model_asset_buffer.
    """
    if not os.path.exists(RUTA_MODELO_TASK):
        print("Descargando face_landmarker.task ...")
        urllib.request.urlretrieve(URL_MODELO_TASK, RUTA_MODELO_TASK)
        print("Descarga completa.")

    with open(RUTA_MODELO_TASK, "rb") as archivo:
        return archivo.read()


def matriz_rotacion_grados(pitch_yaw_roll):
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


def construir_bind_transform():
    T = np.eye(4)
    T[:3, :3] = matriz_rotacion_grados(BIND_ROTACION_GRADOS) * BIND_ESCALA
    T[:3, 3] = BIND_TRASLACION
    return T


def suavizar_matriz_cabeza(matriz_nueva, estado, alpha=0.55):
    """Promedio exponencial + reproyeccion SVD de la rotacion (ver
    prueba_filtro_3d.py para la explicacion completa)."""
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


def cargar_modelo_3d():
    if not os.path.exists(RUTA_GLB):
        print(f"[ERROR] No se encontro el modelo 3D en: {RUTA_GLB}")
        sys.exit(1)

    print("Cargando modelo GLB...")
    escena_glb = trimesh.load(RUTA_GLB, force="scene")
    malla = escena_glb.dump(concatenate=True)

    centro = malla.bounding_box.centroid
    malla.apply_translation(-centro)

    tamano = max(malla.extents)
    malla.apply_scale(2.0 / tamano)

    print("Modelo 3D cargado correctamente.")
    return pyrender.Mesh.from_trimesh(malla, smooth=True)


def crear_escena_3d(mesh_3d, ancho, alto):
    """
    Construida UNA SOLA VEZ. Luces y camara quedan fijas; en cada
    frame solo se actualiza la pose del nodo de la malla con
    escena.set_pose(...), en vez de reconstruir toda la escena.
    """
    escena = pyrender.Scene(bg_color=[0, 0, 0, 0], ambient_light=[0.45, 0.45, 0.45])

    luz1 = pyrender.DirectionalLight(color=np.ones(3), intensity=3.0)
    escena.add(luz1, pose=np.array([
        [1, 0, 0, 20], [0, 1, 0, 20], [0, 0, 1, 40], [0, 0, 0, 1],
    ], dtype=np.float64))

    luz2 = pyrender.DirectionalLight(color=np.ones(3), intensity=2.0)
    escena.add(luz2, pose=np.array([
        [1, 0, 0, -20], [0, 1, 0, 20], [0, 0, 1, 30], [0, 0, 0, 1],
    ], dtype=np.float64))

    camara = pyrender.PerspectiveCamera(
        yfov=np.radians(FOV_VERTICAL_GRADOS),
        aspectRatio=ancho / alto,
        znear=CAM_NEAR,
        zfar=CAM_FAR,
    )
    # Camara en el origen mirando hacia -Z: lo que asume MediaPipe.
    escena.add(camara, pose=np.eye(4))

    nodo_mesh = escena.add(mesh_3d, pose=np.eye(4))

    return escena, nodo_mesh


def renderizar_filtro_3d(renderer, escena, nodo_mesh, pose_final, frame):
    escena.set_pose(nodo_mesh, pose_final)

    color, profundidad = renderer.render(escena)

    # No se usa el canal alfa del material del GLB: algunas texturas
    # (p. ej. el borde negro de la mascara) traen su propio canal
    # alfa de blend/mask y quedan semitransparentes aunque ahi SI
    # hay geometria, dejando ver la cara real detras. En cambio,
    # cualquier pixel con profundidad > 0 (pyrender dibujo algo ahi)
    # se trata como 100% opaco; solo el fondo real queda transparente.
    alpha = (profundidad > 0).astype(np.float32)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)[..., np.newaxis]

    bgr_render = cv2.cvtColor(color, cv2.COLOR_RGB2BGR)

    return (
        bgr_render.astype(np.float32) * alpha
        + frame.astype(np.float32) * (1 - alpha)
    ).astype(np.uint8)


# ============================================================
# MANOS -> NOTAS + GESTO DE MASCARA
# ============================================================

def procesar_manos(hand_results, mp_hands, frame, finger_state,
                    instrument_index, sonidos_por_instrumento, canales,
                    estado_mascara):
    if not hand_results.multi_hand_landmarks:
        estado_mascara["gesto_previo"] = False
        return

    menique_arriba_en_algun_lado = False

    for h, hand_landmarks in enumerate(hand_results.multi_hand_landmarks):
        draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

        hand_label = hand_results.multi_handedness[h].classification[0].label

        for i in range(3):
            finger_down = is_finger_down(hand_landmarks.landmark, i)
            finger_index = i if hand_label == "Left" else i + 3

            if finger_down:
                if not finger_state[finger_index]:
                    canales[finger_index].play(
                        sonidos_por_instrumento[instrument_index][finger_index]
                    )
                    finger_state[finger_index] = True
            else:
                finger_state[finger_index] = False

        if is_pinky_up(hand_landmarks.landmark):
            menique_arriba_en_algun_lado = True

    # Toggle por flanco: solo cambia el estado el instante en que el
    # meñique pasa de abajo a arriba, no mientras se mantiene arriba.
    if menique_arriba_en_algun_lado and not estado_mascara["gesto_previo"]:
        estado_mascara["activa"] = not estado_mascara["activa"]

    estado_mascara["gesto_previo"] = menique_arriba_en_algun_lado


# ============================================================
# MAIN
# ============================================================

def main():
    canales, sonidos_por_instrumento = cargar_sonidos()

    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        max_num_hands=2,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    contenido_modelo_task = asegurar_modelo_task()
    opciones_cara = mp_vision.FaceLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_buffer=contenido_modelo_task),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=True,
    )
    landmarker = mp_vision.FaceLandmarker.create_from_options(opciones_cara)

    cap = cv2.VideoCapture(1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    if not cap.isOpened():
        print("[ERROR] No se pudo abrir la camara.")
        sys.exit(1)

    ret, frame = cap.read()
    if not ret:
        print("[ERROR] La camara no entrego ningun frame.")
        sys.exit(1)

    alto, ancho = frame.shape[:2]

    mesh_3d = cargar_modelo_3d()

    try:
        renderer = pyrender.OffscreenRenderer(viewport_width=ancho, viewport_height=alto)
    except Exception as error:
        print(f"[ERROR] No se pudo crear el renderer 3D: {error}")
        sys.exit(1)

    escena_3d, nodo_mesh = crear_escena_3d(mesh_3d, ancho, alto)
    bind_transform = construir_bind_transform()
    estado_suavizado = {"pose": None}

    finger_state = [False] * 6
    instrument_index = 0
    mouth_state = False
    estado_mascara = {"activa": True, "gesto_previo": False}

    t_inicio = time.time()
    tiempo_anterior = time.time()
    fps_suavizado = 0.0

    print("\nPiano Virtual listo. ESC para salir.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # -------------------- MANOS --------------------
        hand_results = hands.process(rgb)
        procesar_manos(
            hand_results, mp_hands, frame, finger_state,
            instrument_index, sonidos_por_instrumento, canales,
            estado_mascara,
        )

        # -------------------- CARA (landmarks + pose 3D) --------------------
        mp_imagen = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int((time.time() - t_inicio) * 1000)
        resultado_cara = landmarker.detect_for_video(mp_imagen, timestamp_ms)

        if resultado_cara.face_landmarks:
            landmarks = resultado_cara.face_landmarks[0]

            # ----- filtro 3D -----
            if estado_mascara["activa"] and resultado_cara.facial_transformation_matrixes:
                matriz_cabeza = np.array(
                    resultado_cara.facial_transformation_matrixes[0],
                    dtype=np.float64,
                ).reshape(4, 4)

                matriz_cabeza = suavizar_matriz_cabeza(matriz_cabeza, estado_suavizado)
                pose_final = matriz_cabeza @ bind_transform

                frame = renderizar_filtro_3d(
                    renderer, escena_3d, nodo_mesh, pose_final, frame
                )
            elif not estado_mascara["activa"]:
                # Mascara apagada: no se renderiza nada, y se evita
                # que el suavizado arrastre una pose vieja cuando se
                # vuelva a activar.
                estado_suavizado["pose"] = None

            # ----- boca -> cambio de instrumento -----
            boca = mouth_open(landmarks)

            if boca > 0.28:
                mouth_is_open = True
            elif boca < 0.20:
                mouth_is_open = False
            else:
                mouth_is_open = mouth_state

            if mouth_is_open:
                if not mouth_state:
                    instrument_index = (instrument_index + 1) % 3
                    mouth_state = True
            else:
                mouth_state = False
        else:
            estado_suavizado["pose"] = None

        # -------------------- TEXTO --------------------
        cv2.putText(
            frame, "INSTRUMENTO: " + instrument_names[instrument_index],
            (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2,
        )
        cv2.putText(
            frame, "Abre la boca para cambiar",
            (30, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2,
        )
        cv2.putText(
            frame,
            "MASCARA: " + ("ON" if estado_mascara["activa"] else "OFF")
            + "  (menique arriba = alternar)",
            (30, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2,
        )

        tiempo_actual = time.time()
        fps = 1.0 / max(tiempo_actual - tiempo_anterior, 1e-6)
        tiempo_anterior = tiempo_actual
        fps_suavizado = fps_suavizado * 0.9 + fps * 0.1

        cv2.putText(
            frame, f"FPS: {int(fps_suavizado)}",
            (ancho - 110, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2,
        )

        cv2.imshow("Piano Virtual", frame)

        if cv2.waitKey(1) & 0xFF == 27:
            break

    cap.release()
    hands.close()
    landmarker.close()
    renderer.delete()
    cv2.destroyAllWindows()
    pygame.quit()


if __name__ == "__main__":
    main()