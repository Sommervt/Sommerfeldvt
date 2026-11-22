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

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function updateAudioProgress() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const progress = duration > 0 ? currentTime / duration : 0;

  audioSeek.max = String(duration);
  audioSeek.value = String(currentTime);
  audioSeek.style.setProperty("--audio-progress", `${progress * 100}%`);
  audioSeek.setAttribute("aria-valuetext", `${formatTime(currentTime)} / ${formatTime(duration)}`);
  audioCurrentTime.textContent = formatTime(currentTime);
  audioDuration.textContent = formatTime(duration);
}

function updateAudioState() {
  const playing = !audio.paused && !audio.ended;
  audioPlayer.classList.toggle("is-playing", playing);
  audioToggle.setAttribute("aria-label", playing ? "一時停止" : "再生");
  audioToggle.setAttribute("aria-pressed", String(playing));
}

function initializeAudioMetadata() {
  audioSeek.disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
  audioStatus.textContent = "";
  updateAudioProgress();
}

audio.addEventListener("loadedmetadata", initializeAudioMetadata);
audio.addEventListener("durationchange", updateAudioProgress);
audio.addEventListener("timeupdate", updateAudioProgress);
audio.addEventListener("play", updateAudioState);
audio.addEventListener("pause", updateAudioState);
audio.addEventListener("ended", updateAudioState);
audio.addEventListener("error", () => {
  audioSeek.disabled = true;
  audioStatus.textContent = "音源を読み込めませんでした。";
});

async function playAudio(isAutomatic = false) {
  audioStatus.textContent = "";
  try {
    await audio.play();
  } catch (error) {
    audioStatus.textContent = error.name === "NotAllowedError"
      ? isAutomatic
        ? "自動再生はブラウザーにブロックされました。再生ボタンを押してください。"
        : "ブラウザーが再生を制限しました。もう一度お試しください。"
      : "音声を再生できませんでした。";
  }
}

audioToggle.addEventListener("click", () => {
  if (!audio.paused) {
    audio.pause();
    return;
  }

  playAudio();
});

audioSeek.addEventListener("input", () => {
  audio.currentTime = Number(audioSeek.value);
  updateAudioProgress();
});

if (audio.readyState >= 1) initializeAudioMetadata();
playAudio(true);
