import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CancelRoomForm from '../../src/components/activities/CancelRoomForm';

const setup = (props = {}) => {
  const onConfirm = vi.fn();
  render(<CancelRoomForm title="Friday game" pending={false} onConfirm={onConfirm} {...props} />);
  return onConfirm;
};
const reasonField = () => screen.getByLabelText('Cancellation reason');

describe('CancelRoomForm', () => {
  it('explains an empty reason and does not ask for confirmation', async () => {
    const onConfirm = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write a reason so the players know why the room is cancelled.');
    expect(reasonField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('treats a reason of only spaces as empty and clears the message once the user types', async () => {
    setup();
    await userEvent.type(reasonField(), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.type(reasonField(), 'Rain');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks for confirmation before cancelling and shows the reason', async () => {
    const onConfirm = setup();
    await userEvent.type(reasonField(), '  Venue closed  ');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    const confirmation = screen.getByRole('dialog', { name: 'Cancel "Friday game"?' });
    expect(confirmation).toHaveTextContent('Everyone who joined or asked to join will be told.');
    expect(confirmation).toHaveTextContent("This can't be undone.");
    expect(confirmation).toHaveTextContent('Reason: Venue closed');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels only after the user confirms, with the trimmed reason', async () => {
    const onConfirm = setup();
    await userEvent.type(reasonField(), '  Venue closed  ');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel room' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Venue closed');
  });

  it('goes back to the form with the reason kept when the user keeps the room', async () => {
    const onConfirm = setup();
    await userEvent.type(reasonField(), 'Rain');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep the room' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reasonField()).toHaveValue('Rain');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes the pop up with the Close button and with Escape without cancelling', async () => {
    const onConfirm = setup();
    await userEvent.type(reasonField(), 'Rain');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables the buttons while the cancellation is being sent', async () => {
    const { rerender } = render(<CancelRoomForm title="Friday game" pending={false} onConfirm={() => {}} />);
    await userEvent.type(reasonField(), 'Rain');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    rerender(<CancelRoomForm title="Friday game" pending onConfirm={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep the room' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
