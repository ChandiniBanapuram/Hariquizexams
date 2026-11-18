import os
import shutil
import sys
from huggingface_hub import HfApi

REPO_ID = "sairohit45/examination-backend"
TEMP_DIR = "hf_deploy_temp"

def prepare_deploy_folder():
    if os.path.exists(TEMP_DIR):
        print("Cleaning old temporary files...")
        shutil.rmtree(TEMP_DIR)

    print("Creating clean deployment structure...")
    os.makedirs(os.path.join(TEMP_DIR, "backend"), exist_ok=True)

    # Copy files/dirs selectively
    src_backend = "backend"
    dst_backend = os.path.join(TEMP_DIR, "backend")

    for item in os.listdir(src_backend):
        s = os.path.join(src_backend, item)
        d = os.path.join(dst_backend, item)
        if item in ["node_modules", "ml-venv", "student_outputs", "executions"]:
            continue
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True, ignore=shutil.ignore_patterns("node_modules", "ml-venv", "__pycache__", "*.pyc"))
        else:
            shutil.copy2(s, d)

    if os.path.exists("Dockerfile"):
        shutil.copy2("Dockerfile", TEMP_DIR)
    if os.path.exists(".gitignore"):
        shutil.copy2(".gitignore", TEMP_DIR)

    readme_content = """---
title: Examination Backend
emoji: 📝
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---
"""
    with open(os.path.join(TEMP_DIR, "README.md"), "w", encoding="utf-8") as f:
        f.write(readme_content)

def main():
    token = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("HF_TOKEN")
    prepare_deploy_folder()

    api = HfApi(token=token)
    print(f"Uploading deployment files to Hugging Face Space: {REPO_ID}...")
    try:
        api.upload_folder(
            folder_path=TEMP_DIR,
            repo_id=REPO_ID,
            repo_type="space",
            commit_message="Deploy latest changes",
        )
        print("Successfully uploaded to Hugging Face Space!")
    except Exception as e:
        print(f"Error during upload: {e}")

    print("Cleaning up temporary deployment files...")
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    print("Done! Check https://huggingface.co/spaces/sairohit45/examination-backend for build progress.")

if __name__ == "__main__":
    main()
