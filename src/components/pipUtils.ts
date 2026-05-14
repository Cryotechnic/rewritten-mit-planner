import type { PipWindowHandle } from './JobPipWindow';

function applyPipStyles(win: Window, jobName: string): HTMLElement {
  win.document.title = `${jobName} \u2013 Mitigations`;
  win.document.body.style.cssText = 'margin:0;padding:0;height:100vh;overflow:hidden;background:#0f1117';
  const style = win.document.createElement('style');
  style.textContent = `
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #0d1020; }
    ::-webkit-scrollbar-thumb { background: #2d3154; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #3d4270; }
    * { scrollbar-width: thin; scrollbar-color: #2d3154 #0d1020; }
  `;
  win.document.head.appendChild(style);
  const container = win.document.createElement('div');
  container.style.height = '100%';
  win.document.body.appendChild(container);
  return container;
}

export async function openPipWindow(jobJP: string, jobName: string): Promise<PipWindowHandle | null> {
  if (window.documentPictureInPicture) {
    const win = await window.documentPictureInPicture.requestWindow({ width: 300, height: 480 });
    const container = applyPipStyles(win, jobName);
    return { win, container, jobJP, jobName };
  }

  // Fallback for Firefox and other browsers that don't support documentPictureInPicture
  const popup = window.open('', '_blank', 'width=300,height=480,resizable=yes,scrollbars=no');
  if (!popup) {
    alert('Could not open a popup window. Please allow popups for this site.');
    return null;
  }
  const container = applyPipStyles(popup, jobName);
  return { win: popup, container, jobJP, jobName };
}
