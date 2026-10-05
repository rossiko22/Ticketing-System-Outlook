// Folder selection only; applying settings and creating backups need a controller.
(() => {
  const form = document.querySelector('#settings-form');
  const input = document.querySelector('#backup-directory');
  const button = document.querySelector('#select-backup-folder');
  const folderInput = document.querySelector('#folderInput');
  const type = document.querySelector('#backup-destination-type');
  const status = document.querySelector('#backup-folder-status');
  if (!form || !input || !button || !folderInput || !type || !status) return;

  const notify = message => {
    status.textContent = message;
    status.hidden = !message;
  };
  const useServerPath = () => {
    type.value = 'server';
    input.name = 'backupDirectory';
    folderInput.value = '';
    notify('');
  };
  input.addEventListener('input', useServerPath);
  form.addEventListener('reset', useServerPath);

  button.addEventListener('click', () => {
    if (!('webkitdirectory' in folderInput)) {
      notify('Folder selection is unavailable in this browser. Enter a server folder path instead.');
      return;
    }
    folderInput.click();
  });

  folderInput.addEventListener('change', event => {
    const files = event.target.files;
    const relativePath = files[0]?.webkitRelativePath;
    if (!relativePath || !relativePath.includes('/')) {
      notify('No folder files were selected. Choose a folder containing files, or enter a server path.');
      return;
    }
    // Relative paths identify the folder name, not its absolute server location.
    const folderName = relativePath.split('/')[0];
    input.value = folderName;
    input.name = 'backupFolderName';
    type.value = 'local';
    notify(`Selected folder: ${folderName}. This selects existing files; it does not enable writing backups to this folder.`);
    // No upload or file reads are needed to display the folder name.
    // The file input has no name, so its files are excluded from FormData.
    folderInput.value = '';
  });
})();
