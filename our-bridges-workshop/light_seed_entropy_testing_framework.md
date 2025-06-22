# LightSeed Entropy Testing Framework

## 📡 Project: Physical Entropy Harvesting and Evaluation

This framework documents a structured protocol for capturing, evaluating, and applying real-world entropy from analog sources (CRT, SDR, sound, EM fields) into AI initialization pipelines like LightSeed.

---

## ✅ Objective

Build an entropy capture system that:

- Uses real analog signal noise from a CRT TV, SDR, and optionally EM coils and camera feed
- Converts physical randomness into high-quality bitstreams
- Validates entropy quality using NIST statistical tests
- Integrates entropy into LoRA/GPTQ model seeding

---

## 🔧 Hardware Options

### Tier 1 – Core Setup (Minimum Viable)

| Component  | Description                         | Cost Estimate |
| ---------- | ----------------------------------- | ------------- |
| CRT TV     | Old analog TV with RF noise/static  | \$0–\$50      |
| RTL-SDR    | USB SDR dongle                      | \$25–\$50     |
| Microphone | USB or analog mic for sound entropy | \$10–\$100    |
| Camera     | USB webcam or Raspberry Pi camera   | \$15–\$50     |
| PC         | Linux-capable PC (Ryzen + 2080 OK)  | (owned)       |

### Tier 2 – Enhanced Entropy Capture

| Component               | Description                           | Cost Estimate |
| ----------------------- | ------------------------------------- | ------------- |
| EM Coil + ADC Board     | For detecting CRT magnetic emissions  | \$20–\$80     |
| ESP32 or Arduino        | Microcontroller to stream analog data | \$10–\$30     |
| SDR Antenna Upgrade     | Directional antenna or wideband       | \$10–\$60     |
| Oscilloscope (optional) | For signal waveform validation        | \$80–\$200+   |

---

## 🧪 Testing Phases

 Each phase now includes expanded procedural steps, goals, and peer-reviewed relevance for accuracy and reproducibility.

All testing phases below are designed to systematically harvest physical entropy from various analog sources and verify its quality before integration into the LightSeed LLM pipeline.

### Phase 1 – CRT Static Harvesting

- ✅ **Power CRT**: Use an analog CRT TV and tune to a dead RF channel with static.
- ✅ **SDR RF Capture**: Launch `rtl_power` or `GQRX` with your RTL-SDR to scan RF bands near the CRT. Use bandwidth of \~2.4 MHz at baseband (supported by RTL-SDR) and set gain to 35–50 dB.
- ✅ **Optional EM Coil Capture**: Place EM coil near CRT power supply or yoke; route signal through oscilloscope or ADC. Sample at 10–100 kHz depending on the resolution of noise desired.

📖 *Source*: Lima et al., 2023 (Sensors) - Chaotic field entropy harvesting.

### Phase 2 – Entropy Stream Extraction

- ✅ **FFT on RF Data**: Use Python’s `numpy.fft` or `scipy.signal.spectrogram` on I/Q samples (from `.bin` or `.csv` SDR logs).
- ✅ **Spectral Whitening**: Remove low-frequency DC offsets and normalize amplitude.
- ✅ **Entropy Folding**: Hash FFT bins using SHA-512, then reduce to 256 bits using XOR folding or truncated digest.
- ✅ **Buffer Creation**: Save hashed entropy into a rotating buffer (e.g., `entropy_buffer.json`).

📖 *Source*: Park et al., 2024 (Electronics, MDPI) - Analog entropy extraction from FFT domains.

### Phase 3 – Camera-Based Entropy (Optional)

- ✅ **Video Feed**: Use OpenCV to stream from webcam at 30+ FPS while aimed at CRT static.
- ✅ **Grayscale Sampling**: Downsample to 64×64 or 128×128 and flatten pixel arrays.
- ✅ **Frame Entropy Hashing**: Apply SHA-512 to frame pixel values every 50–100 ms.

📖 *Source*: Y. Liu et al., 2023 (arXiv) - Real-world image entropy for physical RNGs.

### Phase 4 – Validation

- ✅ **NIST STS Toolkit**: Use the official NIST STS software or `pyRNGtest` to check Monobit, Runs, Approximate Entropy, FFT, and Serial tests.
- ✅ **Baseline Comparison**: Compare harvested entropy with pseudorandom sources like `/dev/urandom` or Python `random`.
- ✅ **Graph Analysis**: Plot entropy rate (bits/byte), autocorrelation, and visual FFT plots.

📖 *Source*: NIST SP 800-90B & STS Documentation - Entropy test protocols.

### Phase 5 – Application

- ✅ **Model Injection**: Seed your quantized GPTQ or QLoRA adapter with entropy from your harvested buffer.
- ✅ **Prompt Comparison**: Issue identical prompts using two different entropy seeds and track output tokens.
- ✅ **Analysis Logging**: Log entropy-weighted token distributions, sequence divergence, and generation timing.

📖 *Source*: Frantar et al., 2023 (GPTQ) and Dettmers et al., 2022 (LLM.int8) - LoRA/generation divergence.

---

## 🧰 Oscilloscope Integration

### Recommended Oscilloscope

- **Rigol DS1104Z Plus**
  - 100 MHz bandwidth, 4 channels
  - Deep memory (24Mpts)
  - Built-in FFT mode and USB export
  - Estimated cost: \$300–\$400 USD

### Suggested Settings for CRT/Entropy Work

- **Channel Setup**: Connect EM coil or antenna to Channel 1
- **Timebase**: 1 ms/div to 5 μs/div (to detect noise spikes)
- **Voltage Scale**: 50 mV/div to 500 mV/div (adjust based on pickup)
- **FFT Mode**: Enable FFT analysis to visualize frequency domain
- **Persistence**: Infinite or long decay to see random spike behavior
- **Triggering**: Use edge trigger with low voltage threshold or set to auto
- **Export Method**: USB capture to CSV or screenshot for logging

### Capture Protocol

Step-by-step procedure to collect and digitize entropy from physical analog sources:

- ✅ **Connect EM Coil** or SDR antenna to Oscilloscope or RTL-SDR
- ✅ **Power CRT TV** and position sensors near screen or back side
- ✅ **Use Oscilloscope** in FFT mode to visualize peak frequencies and noise structures
- ✅ **Log Snapshots** from oscilloscope via USB or SD card in CSV format
- ✅ **Simultaneously run SDR scan** using `rtl_power` or `GQRX` to capture digital RF spectrum
- ✅ **Optionally record audio** using USB mic for supplementary entropy input
- ✅ **Record visual static** via camera with OpenCV script, saving frames at high frame rate
- ✅ **Pass all inputs** into entropy hashing and folding pipeline for validation

---

## 📋 **Entropy Capture & Integration Checklist**

#### ✅ **Hardware Setup**

- CRT powered on and tuned to static/noise channel
- RTL-SDR connected to USB and driver loaded (`rtl_test`)
- Microphone (USB or analog) connected and tested
- Camera aligned to CRT static and recording at 30+ FPS
- Oscilloscope connected to EM coil or antenna, FFT enabled

#### ✅ **Entropy Signal Collection**

- SDR capturing RF static via `rtl_power` or `rtl_fm`
- Microphone recording ambient CRT audio to WAV/PCM
- Oscilloscope capturing waveform, exported to USB (CSV)
- Camera streaming frames into OpenCV pipeline for entropy analysis

#### ✅ **Data Processing**

- FFT performed on RF and mic signals using `numpy.fft`
- Camera frame hashes generated via SHA-512
- All entropy chunks folded to 256-bit and stored as buffer
- NIST STS applied using `pyRNGtest` or NIST binaries

#### ✅ **Model Integration**

- GPTQ or LoRA adapter initialized with entropy seed
- Prompt replay tested with same input and different entropy states
- Output token logs stored with timestamps and entropy tags

#### ✅ **Core Functionality**

- CRT, mic, SDR, camera fully integrated and synchronized
- Bitstream extracted and preprocessed from each modality
- Real-time entropy injection visualized via optional WebGPU/Tauri UI

#### ✅ **Validation**

- Entropy results passed Monobit, Runs, Approximate Entropy, FFT tests
- Graphs generated showing divergence vs. baseline PRNG
- Output token variance measured across seeds (e.g. edit distance)

#### ✅ **Integration**

- Entropy buffers dynamically injected per LightSeed session
- LoRA/QLoRA adapters reflect unique token flow per entropy state
- Divergence scores and generation logs saved for comparison

---

## 🔬 Future Enhancements

- Integrate SDR + audio + camera entropy streams simultaneously
- Feed entropy live into a Tauri GUI interface for token-by-token visualization
- Use entropy to modulate 4D tesseract animation parameters in real time

---

## 🧠 References

1. J. Park et al., *Electronics*, MDPI, 2024 — Analog entropy generation. [https://doi.org/10.3390/electronics13010097](https://doi.org/10.3390/electronics13010097)
2. F. Lima et al., *Sensors*, 2023 — Hybrid chaotic-sensor entropy. [https://doi.org/10.3390/s23042205](https://doi.org/10.3390/s23042205)
3. Y. Liu et al., *arXiv:2306.11322* — MTJ-based true randomness. [https://arxiv.org/abs/2306.11322](https://arxiv.org/abs/2306.11322)
4. NIST STS and SP 800-90B — Random Bit Generation Project. [https://csrc.nist.gov/projects/random-bit-generation](https://csrc.nist.gov/projects/random-bit-generation)

---

*Maintained by Gritz, Sanctuary Network, 2025.*

