import json
from pathlib import Path
import urllib.request

DATA_PATH = Path("data/pets.json")
IMAGE_DIR = Path("data/images")


def download(url, path):
  request = urllib.request.Request(
    url,
    headers={"User-Agent": "Mozilla/5.0 Codex local image cache"},
  )
  with urllib.request.urlopen(request, timeout=30) as response:
    path.write_bytes(response.read())


def main():
  payload = json.loads(DATA_PATH.read_text())
  IMAGE_DIR.mkdir(parents=True, exist_ok=True)

  for pet in payload["pets"]:
    remote_url = pet.get("remoteImage") or pet.get("image") or ""
    if not remote_url.startswith("http"):
      continue
    extension = Path(remote_url.split("?", 1)[0]).suffix or ".png"
    filename = f"{pet['id']}{extension}"
    local_path = IMAGE_DIR / filename
    if not local_path.exists():
      download(remote_url, local_path)
    pet["remoteImage"] = remote_url
    pet["image"] = f"./data/images/{filename}"

  DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
  main()
