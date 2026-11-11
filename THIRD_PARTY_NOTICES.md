# Third-party software in Captionshaper

Captionshaper is free software under the GNU GPL v3 or later (see LICENSE). It bundles:

| Component | Licence | Source |
|---|---|---|
| whisper.cpp and ggml (speech recognition engine) | MIT | https://github.com/ggml-org/whisper.cpp |
| OpenAI Whisper models (downloaded on first use, ggml format) | MIT | https://github.com/openai/whisper · https://huggingface.co/ggerganov/whisper.cpp |
| Silero VAD v5.1.2 (voice activity detection, ggml format) | MIT | https://github.com/snakers4/silero-vad |
| FFmpeg (static build with libx264 and libass) | GPL v3 | https://ffmpeg.org · build: https://github.com/eugeneware/ffmpeg-static |
| LLVM OpenMP runtime (libomp, macOS) | Apache 2.0 with LLVM exception | https://openmp.llvm.org |
| Geist font | SIL Open Font License 1.1 | https://github.com/vercel/geist-font |
| Montserrat, Poppins, Anton, Bebas Neue and Bangers fonts | SIL Open Font License 1.1 | https://github.com/google/fonts |
| Electron | MIT | https://www.electronjs.org |

The full licence texts are in each project's repository. The Geist licence is in assets/fonts/OFL.txt.
