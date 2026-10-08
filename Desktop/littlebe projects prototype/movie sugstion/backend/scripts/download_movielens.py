"""Download MovieLens ml-latest-small into backend/data/ (idempotent)."""
import urllib.request
import zipfile
from pathlib import Path

URL = "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def main(url: str = URL) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    target = DATA_DIR / "ml-latest-small" / "movies.csv"
    if target.exists():
        print(f"Dataset already present at {target}, skipping download.")
        return target
    zpath = DATA_DIR / "ml-latest-small.zip"
    print(f"Downloading {url} ...")
    urllib.request.urlretrieve(url, zpath)
    print(f"Extracting into {DATA_DIR} ...")
    with zipfile.ZipFile(zpath, "r") as zf:
        zf.extractall(DATA_DIR)
    try:
        zpath.unlink()
    except FileNotFoundError:
        pass
    if not target.exists():
        raise FileNotFoundError(f"Expected {target} after extraction.")
    print(f"Done: {target}")
    return target


if __name__ == "__main__":
    main()
