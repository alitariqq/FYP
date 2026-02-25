# mask_inference_runner.py

from typing import List
from processing.LULC_inference import run_lulc_inference


def run_inference_on_tiles(tile_paths: List[str], year, location_id) -> List[str]:
    """
    Runs inference on a list of downloaded tiles and returns mask paths.

    Parameters
    ----------
    tile_paths : List[str]
        Paths to downloaded image tiles.

    inference_fn : callable
        Your existing inference function that takes a tile path
        and returns the mask path, e.g.:
            mask_path = inference_fn(tile_path)

    Returns
    -------
    List[str]
        List of mask file paths corresponding to each tile.
    """

    mask_paths = []
    count=0
    for idx, tile_path in enumerate(tile_paths):
        count = count + 1
        print(f"Running inference on tile {idx+1}/{len(tile_paths)}: {tile_path}")
        tile_location_id = location_id + str(count)
        mask_path = run_lulc_inference(tile_path,year,tile_location_id)
        mask_paths.append(mask_path)

    return mask_paths
