const toast = document.querySelector(".toast");
let toastTimeout;

document.querySelector(".copy-button").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.classList.add("is-copied");
    showToast("ユーザー名をコピーしました");
    window.setTimeout(() => button.classList.remove("is-copied"), 1400);
  } catch (error) {
    showToast("コピーできませんでした: @sommerfeldvt");
  }
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

const audioPlayer = document.querySelector(".audio-player");
const audio = audioPlayer.querySelector("audio");
const audioToggle = audioPlayer.querySelector(".audio-toggle");
const audioSeek = audioPlayer.querySelector(".audio-seek");
const audioCurrentTime = audioPlayer.querySelector(".audio-current-time");
const audioDuration = audioPlayer.querySelector(".audio-duration");
const audioStatus = audioPlayer.querySelector(".audio-status");
const audioCover = audioPlayer.querySelector(".audio-cover");
const audioTitle = audioPlayer.querySelector(".audio-track-copy strong");
const audioFormat = audioPlayer.querySelector(".audio-format");
const audioDownload = audioPlayer.querySelector(".audio-download");
const audioDownloadFormat = audioPlayer.querySelector(".audio-download-format");
const audioTrackSelect = audioPlayer.querySelector(".audio-track-select");
const audioTrackPicker = audioPlayer.querySelector(".audio-track-picker");
const audioTrackMenu = audioPlayer.querySelector(".audio-track-menu");
const audioTrackOptions = audioPlayer.querySelector(".audio-track-options");
const audioTrackSearch = audioPlayer.querySelector(".audio-track-search");
const audioTrackEmpty = audioPlayer.querySelector(".audio-track-empty");
const audioTrackSelectTitle = audioPlayer.querySelector(".audio-track-select-title");
const audioTracks = [];
let currentTrackIndex = 0;
let resumeAfterLoad = false;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function isCurrentAudioSource() {
  return Boolean(audio.currentSrc)
    && Array.from(audio.querySelectorAll("source"), (source) => source.src).includes(audio.currentSrc);
}

function updateAudioProgress() {
  const hasCurrentSource = isCurrentAudioSource();
  const duration = hasCurrentSource && Number.isFinite(audio.duration) ? audio.duration : 0;
  const currentTime = hasCurrentSource && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const progress = duration > 0 ? currentTime / duration : 0;

  audioSeek.disabled = duration <= 0;
  audioSeek.max = String(duration);
  audioSeek.value = String(currentTime);
  audioSeek.closest(".audio-timeline").style.setProperty("--audio-progress", `${progress * 100}%`);
  audioSeek.setAttribute("aria-valuetext", `${formatTime(currentTime)} / ${formatTime(duration)}`);
  audioCurrentTime.textContent = formatTime(currentTime);
  audioDuration.textContent = formatTime(duration);
}

function updateAudioState() {
  const playing = isCurrentAudioSource() && !audio.paused && !audio.ended;
  audioPlayer.classList.toggle("is-playing", playing);
  audioToggle.setAttribute("aria-label", playing ? "一時停止" : "再生");
  audioToggle.setAttribute("aria-pressed", String(playing));
}

function updateAudioDownload(track) {
  const previousSource = audioDownloadFormat.value;
  audioDownloadFormat.replaceChildren(...track.sources.map(({ src, type }) => {
    const option = document.createElement("option");
    option.value = src;
    option.textContent = type === "audio/mpeg" ? "MP3" : "Opus";
    return option;
  }));
  const selectedSource = track.sources.find(({ src }) => src === previousSource) ?? track.sources[0];
  const format = selectedSource.type === "audio/mpeg" ? "MP3" : "Opus";
  audioDownloadFormat.value = selectedSource.src;
  audioDownload.href = selectedSource.src;
  audioDownload.download = selectedSource.downloadName;
  audioDownload.hidden = false;
  audioDownload.setAttribute("aria-label", `${format}をダウンロード: ${track.title}`);
  audioDownload.title = `${format}をダウンロード`;
}

function loadAudioTrack(index, autoplay = false) {
  currentTrackIndex = (index + audioTracks.length) % audioTracks.length;
  const track = audioTracks[currentTrackIndex];
  const hasSupportedSource = track.sources.some(({ type }) => audio.canPlayType(type) !== "");
  resumeAfterLoad = autoplay && hasSupportedSource;
  audio.pause();
  audioTitle.textContent = track.title;
  audioCover.src = track.cover;
  audioCover.alt = `${track.title}のジャケット画像`;
  audioTrackSelectTitle.textContent = track.title;
  audioTrackSelect.setAttribute("aria-label", `曲を選択: ${track.title}`);
  audioTrackMenu.querySelectorAll(".audio-track-option").forEach((option, index) => {
    option.setAttribute("aria-selected", String(index === currentTrackIndex));
  });
  audioFormat.textContent = track.format;
  updateAudioDownload(track);
  audio.replaceChildren(...track.sources.map(({ src, type }) => {
    const source = document.createElement("source");
    source.src = src;
    source.type = type;
    return source;
  }));
  audioSeek.disabled = true;
  audioStatus.textContent = hasSupportedSource
    ? ""
    : "このブラウザーはOPUS対応を示していません。再生をお試しください。";
  audio.load();
  updateAudioProgress();
  updateAudioState();
}

function initializeAudioMetadata() {
  if (!isCurrentAudioSource()) {
    updateAudioProgress();
    return;
  }

  audioSeek.disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
  audioStatus.textContent = "";
  updateAudioProgress();
}

function resumeAudioWhenReady() {
  if (!resumeAfterLoad || !isCurrentAudioSource()) return;
  resumeAfterLoad = false;
  playAudio(true);
}

audio.addEventListener("loadedmetadata", initializeAudioMetadata);
audio.addEventListener("durationchange", updateAudioProgress);
audio.addEventListener("timeupdate", updateAudioProgress);
audio.addEventListener("canplay", resumeAudioWhenReady);
audio.addEventListener("play", updateAudioState);
audio.addEventListener("playing", () => {
  audioStatus.textContent = "";
  updateAudioState();
});
audio.addEventListener("pause", updateAudioState);
audio.addEventListener("ended", updateAudioState);
audio.addEventListener("error", () => {
  resumeAfterLoad = false;
  if (!isCurrentAudioSource()) {
    const track = audioTracks[currentTrackIndex];
    if (!track.sources.some(({ type }) => audio.canPlayType(type) !== "")) {
      audioStatus.textContent = "このブラウザーではOPUS音源を再生できません。";
    }
    updateAudioState();
    return;
  }

  audioSeek.disabled = true;
  audioStatus.textContent = audio.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
    ? "このブラウザーではOPUS音源を再生できません。"
    : "音源を読み込めませんでした。";
  updateAudioState();
});

async function playAudio(isAutomatic = false) {
  const track = audioTracks[currentTrackIndex];
  const hasSupportedSource = track.sources.some(({ type }) => audio.canPlayType(type) !== "");
  audioStatus.textContent = hasSupportedSource
    ? ""
    : "このブラウザーはOPUS対応を示していません。再生をお試しください。";
  try {
    await audio.play();
  } catch (error) {
    updateAudioState();
    let message = "音声を再生できませんでした。";
    if (error.name === "NotAllowedError") {
      message = isAutomatic
        ? "自動再生はブラウザーにブロックされました。再生ボタンを押してください。"
        : "ブラウザーが再生を制限しました。もう一度お試しください。";
    } else if (error.name === "NotSupportedError") {
      message = "このブラウザーでは音源を再生できません。OPUS対応ブラウザーをお試しください。";
    }
    audioStatus.textContent = message;
  }
}

audioToggle.addEventListener("click", () => {
  resumeAfterLoad = false;
  if (audioPlayer.classList.contains("is-playing")) {
    audio.pause();
    return;
  }

  playAudio();
});

audioSeek.addEventListener("input", () => {
  audio.currentTime = Number(audioSeek.value);
  updateAudioProgress();
});

audioDownloadFormat.addEventListener("change", () => {
  updateAudioDownload(audioTracks[currentTrackIndex]);
});

audioDownload.addEventListener("click", async (event) => {
  const selectedSource = audioTracks[currentTrackIndex].sources.find(
    ({ src }) => src === audioDownloadFormat.value,
  );
  if (!selectedSource || selectedSource.type !== 'audio/ogg; codecs="opus"') return;

  event.preventDefault();
  try {
    const response = await fetch(selectedSource.src);
    if (!response.ok) throw new Error(`Opus音源のダウンロードに失敗しました: ${response.status}`);

    const audioFile = await response.blob();
    const downloadUrl = URL.createObjectURL(new Blob([audioFile], { type: "application/octet-stream" }));
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = selectedSource.downloadName;
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } catch (error) {
    console.error("Opus音源をダウンロードできませんでした:", error);
    audioStatus.textContent = "Opusファイルをダウンロードできませんでした。";
  }
});

function closeAudioTrackMenu(restoreFocus = false) {
  audioTrackMenu.hidden = true;
  audioTrackSelect.setAttribute("aria-expanded", "false");
  if (restoreFocus) audioTrackSelect.focus();
}

function filterAudioTracks() {
  const query = audioTrackSearch.value.trim().toLocaleLowerCase();
  let visibleTracks = 0;
  audioTrackOptions.querySelectorAll(".audio-track-option").forEach((option) => {
    const matches = option.dataset.trackSearchText.includes(query);
    option.hidden = !matches;
    if (matches) visibleTracks += 1;
  });
  audioTrackEmpty.hidden = visibleTracks > 0;
}

audioTrackSelect.addEventListener("click", () => {
  const isOpening = audioTrackMenu.hidden;
  audioTrackMenu.hidden = !isOpening;
  audioTrackSelect.setAttribute("aria-expanded", String(isOpening));
  if (isOpening) {
    audioTrackSearch.value = "";
    filterAudioTracks();
    audioTrackSearch.focus();
  }
});

audioTrackSearch.addEventListener("input", filterAudioTracks);

audioTrackMenu.addEventListener("click", (event) => {
  const option = event.target.closest(".audio-track-option");
  if (!option) return;
  loadAudioTrack(Number(option.dataset.trackIndex), !audio.paused);
  closeAudioTrackMenu(true);
});

audioTrackMenu.addEventListener("keydown", (event) => {
  const options = Array.from(audioTrackOptions.querySelectorAll(".audio-track-option"))
    .filter((option) => !option.hidden);
  if (event.target === audioTrackSearch) {
    if (event.key === "Escape") {
      closeAudioTrackMenu(true);
    } else if (event.key === "ArrowDown" && options.length > 0) {
      event.preventDefault();
      options[0].focus();
    }
    return;
  }

  const currentIndex = options.indexOf(document.activeElement);
  let nextIndex;

  if (event.key === "Escape") {
    closeAudioTrackMenu(true);
    return;
  }
  if (event.key === "ArrowDown") nextIndex = Math.min(currentIndex + 1, options.length - 1);
  if (event.key === "ArrowUp") nextIndex = Math.max(currentIndex - 1, 0);
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = options.length - 1;
  if (nextIndex !== undefined) {
    event.preventDefault();
    options[nextIndex]?.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!audioTrackPicker.contains(event.target) && !audioTrackMenu.hidden) {
    closeAudioTrackMenu();
  }
});

audioPlayer.querySelector(".audio-previous").addEventListener("click", () => {
  loadAudioTrack(currentTrackIndex - 1, !audio.paused && !audio.ended);
});

audioPlayer.querySelector(".audio-next").addEventListener("click", () => {
  loadAudioTrack(currentTrackIndex + 1, !audio.paused && !audio.ended);
});

audio.addEventListener("ended", () => {
  if (isCurrentAudioSource()) loadAudioTrack(currentTrackIndex + 1, true);
});

async function initializeAudioLibrary() {
  try {
    const response = await fetch("music/catalog.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`音楽カタログの取得に失敗しました: ${response.status}`);

    const catalog = await response.json();
    if (!Array.isArray(catalog.tracks) || catalog.tracks.length === 0) {
      throw new Error("音楽カタログに曲がありません");
    }

    for (const [index, track] of catalog.tracks.entries()) {
      if (
        typeof track.title !== "string"
        || typeof track.cover !== "string"
        || typeof track.format !== "string"
        || !Array.isArray(track.sources)
        || track.sources.length === 0
        || track.sources.some(({ src, type, downloadName }) => (
          typeof src !== "string" || typeof type !== "string" || typeof downloadName !== "string"
        ))
      ) {
        throw new Error(`音楽カタログの${index}番目の項目が正しくありません`);
      }

      audioTracks.push(track);
      const option = document.createElement("button");
      option.type = "button";
      option.className = "audio-track-option";
      option.dataset.trackIndex = String(index);
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === 0));
      const cover = document.createElement("img");
      cover.className = "audio-track-option-cover";
      cover.src = track.cover;
      cover.alt = "";
      cover.loading = "lazy";
      const title = document.createElement("span");
      title.className = "audio-track-option-title";
      title.textContent = track.title;
      option.dataset.trackSearchText = track.title.toLocaleLowerCase();
      option.append(cover, title);
      audioTrackOptions.append(option);
    }

    audioTrackSelect.disabled = false;
    audioDownloadFormat.disabled = false;
    audioToggle.disabled = false;
    loadAudioTrack(0);
  } catch (error) {
    console.error("音楽プレイヤーを初期化できませんでした:", error);
    audioStatus.textContent = "音楽ライブラリーを読み込めませんでした。ページを再読み込みしてください。";
  }
}

initializeAudioLibrary();
