import React from 'react';
import { render, screen } from '@testing-library/react';
import MessageBubble from './MessageBubble';

describe('MessageBubble', () => {
  test('renders user message', () => {
    const message = {
      sender: 'user',
      text: 'Hello AI',
      timestamp: '10:00 AM',
    };

    render(<MessageBubble message={message} />);

    expect(screen.getByText('Hello AI')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
  });

  test('renders assistant message', () => {
    const message = {
      sender: 'assistant',
      text: 'Hello User',
      timestamp: '10:01 AM',
    };

    render(<MessageBubble message={message} />);

    expect(screen.getByText('Hello User')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('10:01 AM')).toBeInTheDocument();
  });

  test('renders thinking indicator', () => {
    const message = {
      sender: 'assistant',
      text: '',
    };

    render(<MessageBubble message={message} isThinking={true} />);

    expect(screen.getByText('_')).toBeInTheDocument();
  });

  test('returns null for file upload messages', () => {
    const message = {
      sender: 'user',
      text: 'file.png',
      is_file_upload: true,
    };

    const { container } = render(<MessageBubble message={message} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders without timestamp when thinking', () => {
    const message = {
      sender: 'assistant',
      text: 'Thinking...',
      timestamp: '10:02 AM',
    };

    render(<MessageBubble message={message} isThinking={true} />);

    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.queryByText('10:02 AM')).not.toBeInTheDocument();
  });
});
