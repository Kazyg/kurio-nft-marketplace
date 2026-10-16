import json
from pathlib import Path

from PIL import Image, __version__

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/nfts"
DESTINATION = SOURCE / "responsive"
WIDTHS = (160, 320, 640, 960, 1254)


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    records = []
    for source in sorted(SOURCE.glob("*.png")):
        with Image.open(source) as original:
            outputs = []
            for width in WIDTHS:
                height = round(original.height * width / original.width)
                image = original.resize((width, height), Image.Resampling.LANCZOS)
                target = DESTINATION / f"{source.stem}-{width}.webp"
                image.save(target, "WEBP", quality=90, method=6)
                outputs.append({"width": width, "bytes": target.stat().st_size})
            records.append(
                {
                    "file": source.name,
                    "originalBytes": source.stat().st_size,
                    "outputs": outputs,
                }
            )
    print(
        json.dumps(
            {"pillow": __version__, "quality": 90, "images": records}, indent=2
        )
    )


if __name__ == "__main__":
    main()
