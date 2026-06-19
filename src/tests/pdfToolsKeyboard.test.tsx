import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router';
import PDFTools from '../app/pages/PDFTools';

// Mock react-router
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  };
});

describe('PDFTools Keyboard Shortcuts', () => {
  let mockNavigate: any;
  let mockLocation: any;
  let confirmSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    mockLocation = { pathname: '/pdf-tools', state: {} };
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useLocation).mockReturnValue(mockLocation);

    // Mock window.confirm
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Mock electronAPI
    (window as any).electronAPI = {
      pdfTools: {
        merge: vi.fn().mockImplementation(() => {
          console.log('MERGE MOCK CALLED!');
          return Promise.resolve({ ok: true, output: 'result.pdf' });
        }),
        getPageInfo: vi.fn().mockResolvedValue({ ok: true, pages: [{ width: 100, height: 100 }] }),
      },
      selectSavePath: vi.fn().mockImplementation(() => {
        console.log('SELECTSAVEPATH MOCK CALLED!');
        return Promise.resolve('c:\\DEV\\save_path.pdf');
      }),
      selectFile: vi.fn().mockImplementation(() => {
        console.log('SELECTFILE MOCK CALLED!');
        return Promise.resolve('c:\\DEV\\file1.pdf');
      }),
      shell: {
        openPath: vi.fn(),
      },
    };
  });

  it('Vista active - Enter executes the operation if button is not disabled, and goes to result view', async () => {
    render(
      <MemoryRouter>
        <PDFTools />
      </MemoryRouter>
    );

    const card = screen.getByText('Unir PDFs');
    fireEvent.click(card);

    // Simulate adding files (so button is not disabled)
    const dropzoneContainer = screen.getByText(/Arrastra/i).closest('div')!;
    await act(async () => {
      fireEvent.click(dropzoneContainer);
    });

    // Wait for the file to be added and rendered in the DOM
    expect(await screen.findByText('file1.pdf')).toBeInTheDocument();

    const executeBtn = screen.getByText('EJECUTAR OPERACIÓN').closest('button')!;
    expect(executeBtn).not.toBeDisabled();

    // Get the correct window reference
    const win = document.defaultView || window;

    // Press Enter via win.dispatchEvent
    await act(async () => {
      win.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    });

    // Wait for result view to render
    const resultHeader = await screen.findByText('Unir PDFs completado');
    expect(resultHeader).toBeInTheDocument();

    // Check merge was called
    expect(window.electronAPI.pdfTools.merge).toHaveBeenCalled();

    // Test Vista result - Enter opens the folder
    await act(async () => {
      win.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    });
    expect(window.electronAPI.shell.openPath).toHaveBeenCalledWith('result.pdf');

    // Test Vista result - Escape transitions back to selector
    await act(async () => {
      win.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    });
    expect(screen.getByPlaceholderText('Buscar herramienta...')).toBeInTheDocument();
  });
});
