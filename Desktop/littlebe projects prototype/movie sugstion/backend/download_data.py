"""Download and extract MovieLens ml-latest-small dataset into backend/data/."""
import urllib.request
import zipfile
from pathlib import Path

URL = "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ZIP_PATH = DATA_DIR / "ml-latest-small.zip"


def main(url: str = URL) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    target_dir = DATA_DIR / "ml-latest-small"
    movies_csv = target_dir / "movies.csv"

    if movies_csv.exists():
        print(f"Dataset already present at {movies_csv}, skipping download.")
        return movies_csv

    print(f"Downloading {url} ...")
    urllib.request.urlretrieve(url, ZIP_PATH)
    print(f"Extracting {ZIP_PATH} into {DATA_DIR} ...")
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        zf.extractall(DATA_DIR)

    # Clean up zip (keep extracted files)
    try:
        ZIP_PATH.unlink()
    except FileNotFoundError:
        pass

    if not movies_csv.exists():
        raise FileNotFoundError(f"Expected {movies_csv} after extraction, not found.")
    print(f"Done. movies.csv at {movies_csv}")
    return movies_csv


if __name__ == "__main__":
    main()
