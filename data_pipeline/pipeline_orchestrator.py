"""
pipeline_orchestrator.py
------------------------
Master runner executing scripts 01 to 04 in order.
Pulls real NASA COOLR events, extracts real precipitation windows,
computes SRTM 30m terrain features, and compiles bhoomirakshak_training_data_ner.csv.
"""

import os
import sys
import importlib

# Add current directory to path
curr_dir = os.path.dirname(os.path.abspath(__file__))
if curr_dir not in sys.path:
    sys.path.insert(0, curr_dir)

import importlib.util

def run_script(module_name, filename):
    filepath = os.path.join(curr_dir, filename)
    print(f"\n=======================================================")
    print(f">> EXECUTING DATA PIPELINE STAGE: {filename}")
    print(f"=======================================================")
    spec = importlib.util.spec_from_file_location(module_name, filepath)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    res = mod.main(output_dir=curr_dir)
    return res

def run_all_stages():
    print("Initiating BhoomiRakshak Data Pipeline Execution for NER...")
    
    # Stage 1: NASA COOLR
    df1 = run_script("stage1", "01_collect_coolr_landslides.py")
    
    # Stage 2: Rainfall Accumulation Windows
    df2 = run_script("stage2", "02_collect_rainfall_imerg.py")
    
    # Stage 3: SRTM 30m DEM Terrain
    df3 = run_script("stage3", "03_collect_terrain_srtm.py")
    
    # Stage 4: Training Table Compilation
    df4 = run_script("stage4", "04_build_training_table.py")
    
    print("\n=======================================================")
    print("[SUCCESS] BHOOMIRAKSHAK DATA PIPELINE COMPLETE!")
    print(f"Target dataset: {os.path.join(curr_dir, 'bhoomirakshak_training_data_ner.csv')}")
    print(f"Total rows compiled: {len(df4) if df4 is not None else 0}")
    print("=======================================================\n")
    return {
        "status": "SUCCESS",
        "coolr_count": len(df1) if df1 is not None else 0,
        "rainfall_count": len(df2) if df2 is not None else 0,
        "terrain_count": len(df3) if df3 is not None else 0,
        "training_samples": len(df4) if df4 is not None else 0
    }

if __name__ == "__main__":
    run_all_stages()
