#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
INCOMING_DIR = ROOT / "music" / "incoming"
TRACKS_DIR = ROOT / "music" / "tracks"
COVERS_DIR = ROOT / "music" / "covers"
BACKUPS_DIR = ROOT / "music" / "backups"
CATALOG_PATH = ROOT / "music" / "catalog.json"
COVER_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def fail(message):
    raise RuntimeError(message)


def probe(path):
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name",
            "-show_entries",
            "format=bit_rate",
            "-of",
            "json",
            str(path.resolve()),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        fail(f"{path} を確認できませんでした: {result.stderr.strip()}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        fail(f"{path} の ffprobe 出力を解析できません: {error}")


def validate_opus(path):
    media = probe(path)
    streams = media.get("streams", [])
    if len(streams) != 1 or streams[0].get("codec_type") != "audio" or streams[0].get("codec_name") != "opus":
        fail(f"{path}: Opus音声ストリームが1つだけ必要です")

    bitrate = int(media.get("format", {}).get("bit_rate", 0))
    if not 310_000 <= bitrate <= 330_000:
        fail(f"{path}: 平均ビットレート {bitrate} bps は310～330 kbpsの範囲外です")


def validate_mp3(path):
    media = probe(path)
    streams = media.get("streams", [])
    if len(streams) != 1 or streams[0].get("codec_type") != "audio" or streams[0].get("codec_name") != "mp3":
        fail(f"{path}: MP3音声ストリームが1つだけ必要です")


def validate_cover(path):
    with path.open("rb") as cover:
        header = cover.read(12)
    extension = path.suffix.lower()
    valid = (
        (extension in {".jpg", ".jpeg"} and header.startswith(b"\xff\xd8\xff"))
        or (extension == ".png" and header.startswith(b"\x89PNG\r\n\x1a\n"))
        or (extension == ".webp" and header[:4] == b"RIFF" and header[8:12] == b"WEBP")
    )
    if not valid:
        fail(f"{path}: ファイルの内容と画像の拡張子が一致しません")


def collect_incoming_uploads():
    if not INCOMING_DIR.exists():
        return []

    uploads = {}
    for path in sorted(INCOMING_DIR.iterdir(), key=lambda item: item.name.casefold()):
        if path.name == ".gitkeep":
            continue
        if not path.is_file():
            fail(f"{path}: アップロードするファイルは music/incoming/ 直下に置いてください")

        extension = path.suffix
        if extension != ".opus" and extension.lower() not in COVER_EXTENSIONS:
            fail(f"{path}: .opus音源と、同じ名前の .jpg、.jpeg、.png、.webp のジャケットをアップロードしてください")

        pair = uploads.setdefault(path.stem, {"tracks": [], "covers": []})
        pair["tracks" if extension == ".opus" else "covers"].append(path)

    result = []
    for stem, pair in uploads.items():
        if len(pair["tracks"]) != 1 or len(pair["covers"]) != 1:
            fail(f"{stem}: music/incoming/ に同じ名前の .opus音源とジャケットを1つずつ置いてください")

        track = pair["tracks"][0]
        cover = pair["covers"][0]
        target_track = TRACKS_DIR / track.name
        target_cover = COVERS_DIR / cover.name
        if target_track.exists() or target_cover.exists():
            fail(f"{stem}: 同じ名前の曲またはジャケットがすでにあります。別のファイル名を指定してください")

        validate_opus(track)
        validate_cover(cover)
        result.append((track, cover))
    return result


def cover_for_track(track):
    matches = [
        path
        for path in COVERS_DIR.iterdir()
        if path.is_file() and path.stem == track.stem and path.suffix.lower() in COVER_EXTENSIONS
    ]
    if len(matches) != 1:
        fail(f"{track}: music/covers/ に同じ名前のジャケットが1つ必要です")
    validate_cover(matches[0])
    return matches[0]


def create_mp3_backup(track, backup):
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".mp3-backup-",
        suffix=".mp3",
        dir=BACKUPS_DIR,
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(track.resolve()),
                "-map",
                "0:a:0",
                "-vn",
                "-c:a",
                "libmp3lame",
                "-q:a",
                "2",
                str(temporary_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            fail(f"{track} のMP3変換に失敗しました: {result.stderr.strip()}")
        validate_mp3(temporary_path)
        os.chmod(temporary_path, 0o644)
        os.replace(temporary_path, backup)
    finally:
        temporary_path.unlink(missing_ok=True)


def build_catalog():
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    tracks = sorted(TRACKS_DIR.glob("*.opus"), key=lambda item: item.name.casefold())
    if not tracks:
        fail(f"{TRACKS_DIR} にOpus音源がありません")

    catalog_tracks = []
    used_covers = set()
    for track in tracks:
        validate_opus(track)
        cover = cover_for_track(track)
        used_covers.add(cover)

        backup = BACKUPS_DIR / f"{track.stem}.mp3"
        if backup.exists():
            validate_mp3(backup)
        else:
            create_mp3_backup(track, backup)

        catalog_tracks.append(
            {
                "title": track.stem,
                "cover": quote(cover.relative_to(ROOT).as_posix(), safe="/"),
                "format": "OPUS + MP3",
                "sources": [
                    {
                        "src": quote(track.relative_to(ROOT).as_posix(), safe="/"),
                        "type": 'audio/ogg; codecs="opus"',
                        "downloadName": track.name,
                    },
                    {
                        "src": quote(backup.relative_to(ROOT).as_posix(), safe="/"),
                        "type": "audio/mpeg",
                        "downloadName": backup.name,
                    },
                ],
            }
        )

    for cover in COVERS_DIR.iterdir():
        if cover.is_file() and cover.suffix.lower() in COVER_EXTENSIONS and cover not in used_covers:
            fail(f"{cover}: music/tracks/ に同じ名前のOpus音源がありません")

    catalog = {"tracks": catalog_tracks}
    descriptor, temporary_name = tempfile.mkstemp(prefix=".catalog-", dir=CATALOG_PATH.parent)
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(catalog, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.chmod(temporary_path, 0o644)
        os.replace(temporary_path, CATALOG_PATH)
    finally:
        temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="アップロードされたOpus音源とジャケットを処理します。")
    parser.add_argument(
        "--check",
        action="store_true",
        help="ファイルを移動・変換せずに、音源とジャケットの組み合わせを検証します",
    )
    args = parser.parse_args()

    for command in ("ffprobe", "ffmpeg"):
        if shutil.which(command) is None:
            fail(f"必要なコマンドが見つかりません: {command}")

    uploads = collect_incoming_uploads()
    if args.check:
        print(f"{len(uploads)}件のアップロードを検証しました。")
        return

    TRACKS_DIR.mkdir(parents=True, exist_ok=True)
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    for track, cover in uploads:
        track_target = TRACKS_DIR / track.name
        cover_target = COVERS_DIR / cover.name
        track.replace(track_target)
        cover.replace(cover_target)
        print(f"曲とジャケットを追加しました: {track.stem}")

    build_catalog()
    track_count = len(list(TRACKS_DIR.glob("*.opus")))
    print(f"{CATALOG_PATH.relative_to(ROOT)} を更新しました（全{track_count}曲）。")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
