from pydub import AudioSegment
import os

# Initialize an empty audio segment
combined = AudioSegment.empty()

# Read the MP3 file paths from a text file
def read_file_list(file_path):
    with open(file_path, 'r') as file:
        return [line.strip() for line in file if line.strip()]

# Load the list of MP3 files
audio_files = read_file_list("./src/uploads/audioslist.txt")

# Concatenate audio files
for file in audio_files:
    if os.path.isfile(file):
        audio = AudioSegment.from_mp3(file)
        combined += audio
    else:
        print(f"File not found: {file}")


output_file_path = "./src/uploads/output.mp3"
combined.export(output_file_path, format='mp3')