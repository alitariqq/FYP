# processing/deforestation_model.py
import torch
import onnxruntime as ort
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent / "models"
MODEL_PT_PATH =  BASE_DIR / "amazon_deforestation_v1.pt"
MODEL_ONNX_PATH = BASE_DIR / "amazon_deforestation_v1.onnx"

class DeforestationModel:
    def __init__(self):
        print("🔥 Loading deforestation model...")

        try:
            self.model = torch.jit.load(MODEL_PT_PATH, map_location="cuda")
            self.model.eval()
            self.backend = "torch"
            print("Loaded Torch model")
        except:
            self.session = ort.InferenceSession(MODEL_ONNX_PATH, providers=["CUDAExecutionProvider"])
            self.backend = "onnx"
            print("Loaded ONNX model")

    def predict(self, before_image, after_image):
        if self.backend == "torch":
            return self.model(before_image, after_image).detach().cpu().numpy()

        if self.backend == "onnx":
            inputs = {
                self.session.get_inputs()[0].name: before_image,
                self.session.get_inputs()[1].name: after_image
            }
            return self.session.run(None, inputs)[0]

MODEL = DeforestationModel()
