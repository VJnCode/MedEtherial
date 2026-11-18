import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IncidentStatusBadge, SeverityBadge, StatCard } from '@/components/common';
import { Activity } from 'lucide-react';

describe('status components', () => {
  it('renders human labels for incident status', () => {
    render(<IncidentStatusBadge status="en_route" />);
    expect(screen.getByText('En route to patient')).toBeInTheDocument();
  });
  it('renders severity', () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText('critical')).toBeInTheDocument();
  });
  it('renders stat card value', () => {
    render(<StatCard label="Units" value={7} icon={Activity} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Units')).toBeInTheDocument();
  });
});
