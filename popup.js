let mediaRecorder = null;
let audioContext = null;
let audioStream = null;
let fullTranscript = '';
let startTime = null;

function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function startCapture() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });
    
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('No audio track available');
    }
    
    audioStream = new MediaStream([audioTrack]);
    stream.getVideoTracks().forEach(track => track.stop());
    
    return audioStream;
  } catch (error) {
    console.error('Capture error:', error);
    throw error;
  }
}

document.getElementById('startTranscription').addEventListener('click', async () => {
  const startButton = document.getElementById('startTranscription');
  const stopButton = document.getElementById('stopTranscription');
  const statusDiv = document.getElementById('status');
  const errorDiv = document.getElementById('error');

  try {
    startButton.disabled = true;
    stopButton.disabled = false;
    statusDiv.textContent = 'Select the tab to capture...';
    errorDiv.textContent = '';
    startTime = Date.now();

    const stream = await startCapture();
    
    if (!stream) {
      throw new Error('Failed to start audio capture');
    }

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);

    statusDiv.textContent = 'Starting recording...';
    
    mediaRecorder = new MediaRecorder(destination.stream);
    let audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await sendToWhisperAPI(audioBlob);
        audioChunks = [];
        
        if (!mediaRecorder.manualStop) {
          mediaRecorder.start(15000); // Capture in 15-second chunks
        }
      }
    };
    
    mediaRecorder.start(15000);
    statusDiv.textContent = 'Recording...';

  } catch (error) {
    console.error('Setup error:', error);
    errorDiv.textContent = `Error: ${error.message}`;
    statusDiv.textContent = 'Failed to start';
    startButton.disabled = false;
    stopButton.disabled = true;
  }
});

document.getElementById('stopTranscription').addEventListener('click', async () => {
  if (mediaRecorder) {
    mediaRecorder.manualStop = true;
    mediaRecorder.stop();
  }
  
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
  document.getElementById('startTranscription').disabled = false;
  document.getElementById('stopTranscription').disabled = true;
  document.getElementById('status').textContent = 'Stopped';
  startTime = null;
});

document.getElementById('clearTranscript').addEventListener('click', () => {
  fullTranscript = '';
  document.getElementById('transcription').innerHTML = '';
});

async function sendToWhisperAPI(audioBlob) {
  const statusDiv = document.getElementById('status');
  const errorDiv = document.getElementById('error');
  const transcriptionDiv = document.getElementById('transcription');
  
  statusDiv.textContent = 'Transcribing...';
  errorDiv.textContent = '';
  
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer {insert API key}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const timestamp = formatTimestamp((Date.now() - startTime) / 1000);
    
    // Add new text with timestamp
    const newText = `[${timestamp}] ${data.text}\n\n`;
    fullTranscript += newText;
    
    // Update display
    transcriptionDiv.innerHTML = fullTranscript;
    transcriptionDiv.scrollTop = transcriptionDiv.scrollHeight;
    
    statusDiv.textContent = 'Recording...';
  } catch (error) {
    console.error('Transcription error:', error);
    errorDiv.textContent = `Transcription error: ${error.message}`;
  }
}

// Save transcript when popup closes
window.addEventListener('beforeunload', () => {
  if (fullTranscript) {
    chrome.storage.local.set({ 'savedTranscript': fullTranscript });
  }
});

// Load transcript when popup opens
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['savedTranscript'], (result) => {
    if (result.savedTranscript) {
      fullTranscript = result.savedTranscript;
      document.getElementById('transcription').innerHTML = fullTranscript;
    }
  });
});