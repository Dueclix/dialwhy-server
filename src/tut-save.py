import subprocess
import sys

files = sys.argv

output_path = files[1].replace("video-", "")

command = [
    "ffmpeg",
    "-i",
    files[1],
    "-i",
    files[2],
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-strict",
    "experimental",
    output_path,
]

subprocess.run(command, check=True)

print(f"Successfully merged audio and video. Saved as: {output_path}")
