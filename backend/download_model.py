from sentence_transformers import SentenceTransformer
import os

def download_model():
    """
    Downloads the sentence-transformer model to a local directory.
    """
    model_name = 'all-MiniLM-L6-v2'
    # We will save the model to backend/models/all-MiniLM-L6-v2
    model_path = os.path.join(os.path.dirname(__file__), 'models', model_name)

    # Check for the existence of a key file to determine if the model is fully downloaded.
    if not os.path.exists(os.path.join(model_path, 'model.safetensors')):
        print(f"Downloading model to {model_path}...")
        model = SentenceTransformer(model_name)
        model.save(model_path)
        print("Model downloaded successfully.")
    else:
        print("Model already exists locally.")

if __name__ == "__main__":
    download_model()