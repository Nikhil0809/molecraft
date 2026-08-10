import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignupPage from '@/app/signup/page';

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    signup: jest.fn().mockResolvedValue({ user: { id: '1', email: 'test@test.com' } }),
    beginOnboarding: jest.fn(),
    finishOnboarding: jest.fn(),
  }),
}));

describe('SignupPage', () => {
  it('renders signup form as a single step', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Organization / Lab')).toBeInTheDocument();
    expect(screen.getByLabelText('Institutional Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue →' })).not.toBeInTheDocument();
  });

  it('shows error when fields are empty', async () => {
    render(<SignupPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => {
      expect(screen.getByText('Please fill in all required fields.')).toBeInTheDocument();
    });
  });

  it('shows error when terms are not accepted', async () => {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Evelyn Harper' } });
    fireEvent.change(screen.getByLabelText('Institutional Email'), { target: { value: 'harper@institution.edu' } });
    fireEvent.change(screen.getByLabelText('Organization / Lab'), { target: { value: 'Stanford BioML Group' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'supersecret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => {
      expect(screen.getByText('You must agree to the Terms of Service and Privacy Policy.')).toBeInTheDocument();
    });
  });

  it('shows inline error for an invalid email on blur', async () => {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText('Institutional Email'), { target: { value: 'not-an-email' } });
    fireEvent.blur(screen.getByLabelText('Institutional Email'));
    await waitFor(() => {
      expect(screen.getByText('Enter a valid institutional email.')).toBeInTheDocument();
    });
  });

  it('shows an inline error and blocks submit for an invalid email', async () => {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Evelyn Harper' } });
    fireEvent.change(screen.getByLabelText('Institutional Email'), { target: { value: 'harper@institution' } });
    fireEvent.change(screen.getByLabelText('Organization / Lab'), { target: { value: 'Stanford BioML Group' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'supersecret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    });
  });

  it('shows a stronger-password hint for short passwords', async () => {
    render(<SignupPage />);
    const password = screen.getByLabelText('Password');
    fireEvent.change(password, { target: { value: 'abc' } });
    fireEvent.blur(password);
    await waitFor(() => {
      expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    });
  });

  it('shows password strength meter as the user types', async () => {
    render(<SignupPage />);
    const password = screen.getByLabelText('Password');
    fireEvent.change(password, { target: { value: 'Sup3rSecret!2026' } });
    await waitFor(() => {
      expect(screen.getByText('Strong')).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    render(<SignupPage />);
    const password = screen.getByLabelText('Password');
    fireEvent.change(password, { target: { value: 'supersecret123' } });
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });
});