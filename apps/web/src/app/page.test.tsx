import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LandingPage from '@/app/page';

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(),
    signup: jest.fn(),
  }),
}));

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({ data: [] })),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  })) as any;
});

describe('LandingPage', () => {
  it('renders hero section with title', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Autonomous AI/)).toBeInTheDocument();
    expect(screen.getByText(/Drug Discovery/)).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<LandingPage />);
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Modules' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tech Stack' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuum' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Capabilities' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument();
  });

  it('renders auth buttons', () => {
    render(<LandingPage />);
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('shows feature cards', () => {
    render(<LandingPage />);
    expect(screen.getByText('Generative Chemistry Suite')).toBeInTheDocument();
    expect(screen.getAllByText('Structure-Based Docking')[0]).toBeInTheDocument();
    expect(screen.getByText('RNA Therapeutics Design')).toBeInTheDocument();
    expect(screen.getByText('ADMET Toxicity Profiling')).toBeInTheDocument();
    expect(screen.getByText('Peptide & Macrocycle Core')).toBeInTheDocument();
    expect(screen.getByText('Autonomous Lab Automation')).toBeInTheDocument();
  });

  it('shows pipeline phases', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Phase 01/)).toBeInTheDocument();
    expect(screen.getByText(/Phase 02/)).toBeInTheDocument();
    expect(screen.getByText(/Phase 03/)).toBeInTheDocument();
    expect(screen.getByText('Literature Synthesis & Multi-Omics RAG')).toBeInTheDocument();
    expect(screen.getByText('Generative Structure Optimization')).toBeInTheDocument();
    expect(screen.getByText('In-Silico Docking & ADMET Profiling')).toBeInTheDocument();
  });

  it('shows comparison table', () => {
    render(<LandingPage />);
    expect(screen.getByText('Licensing Structure')).toBeInTheDocument();
    expect(screen.getByText('Open Source (MIT)')).toBeInTheDocument();
    expect(screen.getByText('De Novo Architecture')).toBeInTheDocument();
    expect(screen.getByText('On-Prem Deployment')).toBeInTheDocument();
  });

  it('shows microservices registry section', () => {
    render(<LandingPage />);
    expect(screen.getByText('Docker Microservices Registry')).toBeInTheDocument();
    expect(screen.getAllByText(/API Gateway/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Foundation Models/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Generative Diffusion/)[0]).toBeInTheDocument();
  });

  it('renders footer sections', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { name: /Platform Modules/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Implemented Stack/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Developer Resources/i })).toBeInTheDocument();
  });
});