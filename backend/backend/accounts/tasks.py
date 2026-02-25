# queries/tasks.py

from celery import shared_task
#from processing.imagery_downloader import download_pair
from processing.inference import generate_deforestation_mask
from processing.newDownloader import download_pair
from processing.LULC_Downloader import LULC_Temp_Downloader
from processing.LULC_inference import run_lulc_inference
from processing.LULC_Mask import save_colored_mask
from processing.LULC_Image_Acquistion import download_large_area
from processing.LULC_multiple_image_inference import run_inference_on_tiles
from processing.stitch_masks import stitch_masks
from processing.stitch_imagery import stitch_images

#@shared_task
#def run_deforestation_job(lat, lon, location_id):
    #img_path = download_large_area(lat,lon,location_id)
    #inference_path = run_inference_on_tiles(img_path,location_id)
    #mask_path = stitch_masks(inference_path, location_id)
    #output_path = save_colored_mask(mask_path,location_id)
    #sat_path = stitch_images(img_path,2021,location_id)


    #image_path = LULC_Temp_Downloader(lat,lon,location_id)
    #result_path = run_lulc_inference(image_path, location_id)
    #mask_path = save_colored_mask(result_path, location_id)




    #before, after = download_pair(lat, lon, location_id)
    #result_path = generate_deforestation_mask(before,after,location_id)
    #return str(output_path)

@shared_task
def run_LULC_job(lat,lon,radius,year,location_id):
    img_path = download_large_area(lat,lon,radius,year,location_id)
    inference_path = run_inference_on_tiles(img_path,year,location_id)
    mask_path = stitch_masks(inference_path,year,location_id)
    output_path = save_colored_mask(mask_path,year,location_id)
    sat_path = stitch_images(img_path,year,location_id)
    return str(output_path),str(sat_path)
