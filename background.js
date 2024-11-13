let activeStream = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      try {
        const constraints = {
          audio: {
            mandatory: {
              chromeMediaSource: 'tab'
            }
          },
          video: false
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = stream;
        sendResponse({success: true});
      } catch (error) {
        console.error('Capture error:', error);
        sendResponse({error: error.message});
      }
    });
    return true;
  }
  
  if (request.action === 'getStream') {
    sendResponse({stream: activeStream});
    return true;
  }
  
  if (request.action === 'stopCapture') {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      activeStream = null;
    }
    sendResponse({success: true});
    return true;
  }
});