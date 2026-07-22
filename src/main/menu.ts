import { Menu, type MenuItemConstructorOptions, BrowserWindow } from 'electron';

export function createMenu(mainWindow: BrowserWindow): Menu {
  // Minimal menu — only Edit roles for keyboard shortcuts (Ctrl+C/V/X/Z).
  // No visible menu bar; the app uses its own in-app UI for navigation.
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'toggleDevTools' },
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Hide the menu bar on Windows/Linux (macOS uses the system menu bar)
  if (process.platform !== 'darwin') {
    mainWindow.autoHideMenuBar = true;
    mainWindow.setMenuBarVisibility(false);
  }

  return menu;
}
