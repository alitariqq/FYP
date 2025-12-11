# processing/inference.py
import rasterio
import numpy as np
from .deforestation_model import MODEL

def run_deforestation_detection(before_path, after_path):

    with rasterio.open(before_path) as b:
        before = b.read().astype("float32")

    with rasterio.open(after_path) as a:
        after = a.read().astype("float32")

    # normalize or reshape if needed
    before = before[np.newaxis, ...]
    after = after[np.newaxis, ...]

    prediction = MODEL.predict(before, after)

    return prediction
