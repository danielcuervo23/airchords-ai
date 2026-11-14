import soundfile as sf
import librosa
import numpy as np


def cambiar_tono_y_volumen(entrada, salida):
    audio, sr = sf.read(entrada)

    if audio.ndim == 1:
        resultado = librosa.effects.pitch_shift(
            audio,
            sr=sr,
            n_steps=1
        )
    else:
        canales = []

        for i in range(audio.shape[1]):
            canal = librosa.effects.pitch_shift(
                audio[:, i],
                sr=sr,
                n_steps=1
            )
            canales.append(canal)

        resultado = np.column_stack(canales)

    # Bajar el volumen
    resultado = resultado * 0.55

    # Evitar saturación
    maximo = np.max(np.abs(resultado))

    if maximo > 0.95:
        resultado = resultado * (0.95 / maximo)

    sf.write(salida, resultado, sr, subtype="PCM_16")


# A#3 -> B3
cambiar_tono_y_volumen(
    "ViolinReal2/violin-a#3.wav",
    "Violin/B3_Si.wav"
)

# E4 -> F4
cambiar_tono_y_volumen(
    "ViolinReal2/violin-e4.wav",
    "Violin/F4_Fa.wav"
)

print("B3 y F4 creados correctamente.")