#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tracks_dir="$repo_root/music/tracks"
backups_dir="$repo_root/music/backups"
temporary_backup=""

cleanup() {
  if [[ -n "$temporary_backup" ]]; then
    rm -f -- "$temporary_backup"
  fi
}
trap cleanup EXIT

for command_name in ffprobe ffmpeg; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '必要なコマンドが見つかりません: %s\n' "$command_name" >&2
    exit 1
  fi
done

validate_audio_codec() {
  local file_path="$1"
  local expected_codec="$2"
  local codec_output
  local codecs=()

  if ! codec_output="$(ffprobe -v error -select_streams a -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$file_path")"; then
    printf '音声ファイルを確認できませんでした: %s\n' "$file_path" >&2
    return 1
  fi

  if [[ -z "$codec_output" ]]; then
    printf '音声ストリームが見つかりません: %s\n' "$file_path" >&2
    return 1
  fi

  mapfile -t codecs <<< "$codec_output"
  if [[ "${#codecs[@]}" -ne 1 || "${codecs[0]}" != "$expected_codec" ]]; then
    printf '%s に %s 音声ストリームが1つだけ必要です\n' "$file_path" "$expected_codec" >&2
    return 1
  fi
}

shopt -s nullglob
tracks=("$tracks_dir"/*.opus)
if [[ "${#tracks[@]}" -eq 0 ]]; then
  printf 'Opus音源が見つかりません: %s\n' "$tracks_dir"
  exit 0
fi

mkdir -p "$backups_dir"

for track in "${tracks[@]}"; do
  validate_audio_codec "$track" opus
  track_name="${track##*/}"
  track_stem="${track_name%.opus}"
  backup="$backups_dir/$track_stem.mp3"

  if [[ -e "$backup" ]]; then
    validate_audio_codec "$backup" mp3
    printf '既存のMP3バックアップを確認しました: %s\n' "$backup"
    continue
  fi

  temporary_backup="$(mktemp "$backups_dir/.mp3-backup.XXXXXX")"
  if ! ffmpeg -hide_banner -loglevel error -y -i "$track" -map 0:a:0 -vn -c:a libmp3lame -q:a 2 -f mp3 "$temporary_backup"; then
    printf 'MP3バックアップを作成できませんでした: %s\n' "$track" >&2
    exit 1
  fi

  validate_audio_codec "$temporary_backup" mp3
  chmod 644 "$temporary_backup"
  mv -- "$temporary_backup" "$backup"
  temporary_backup=""
  printf 'MP3バックアップを作成しました: %s\n' "$backup"
done
