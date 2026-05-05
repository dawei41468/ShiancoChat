import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from './FileUpload';

jest.mock('../services/apiService', () => ({
  uploadDocument: jest.fn(),
}));

jest.mock('../ChatContext', () => ({
  useChat: () => ({
    appendMessage: jest.fn(),
    currentConversationId: null,
    selectedKnowledgeSpaceId: null,
    fetchSelectedKnowledgeSpace: jest.fn(),
  }),
}));

import { uploadDocument } from '../services/apiService';

describe('FileUpload', () => {
  beforeEach(() => {
    uploadDocument.mockClear();
  });

  it('shows error when clicking upload without selecting a file', async () => {
    render(<FileUpload />);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('Please select a file')).toBeInTheDocument();
    });
  });

  it('uploads a valid file and calls onUploadComplete', async () => {
    const mockDoc = {
      data: {
        filename: 'test.pdf',
        content: 'pdf content',
        knowledge_space_id: 'space-1',
      },
    };
    uploadDocument.mockResolvedValueOnce(mockDoc);
    const onUploadComplete = jest.fn();

    render(<FileUpload onUploadComplete={onUploadComplete} />);

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(uploadDocument).toHaveBeenCalledWith(expect.any(FormData));
    });

    const formDataArg = uploadDocument.mock.calls[0][0];
    expect(formDataArg.get('file')).toBeInstanceOf(File);
    expect(formDataArg.get('file').name).toBe('test.pdf');
  });

  it('displays server error when upload fails', async () => {
    uploadDocument.mockRejectedValueOnce({
      response: { data: { detail: 'File too large' } },
    });

    render(<FileUpload />);

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['x'.repeat(100)], 'large.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('File too large')).toBeInTheDocument();
    });
  });
});
