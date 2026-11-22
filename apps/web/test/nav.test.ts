import { describe, expect, it } from 'vitest';
import { navFor, requiredPermissionsFor } from '@/lib/nav';

const hrefs = (roles: string[]) => navFor(roles).map((n) => n.href);

describe('role-based navigation', () => {
  it('patients see care + SOS but no ops screens', () => {
    const h = hrefs(['patient']);
    expect(h).toContain('/app/emergency');
    expect(h).toContain('/app/doctors');
    expect(h).toContain('/app/records');
    expect(h).not.toContain('/app/dispatch');
    expect(h).not.toContain('/app/admin/users');
  });

  it('doctors see their patients, not the patient-only records page', () => {
    const h = hrefs(['doctor']);
    expect(h).toContain('/app/patients');
    expect(h).not.toContain('/app/records');
    expect(h).not.toContain('/app/emergency');
  });

  it('paramedics get the crew console', () => {
    const h = hrefs(['paramedic']);
    expect(h).toContain('/app/paramedic');
    expect(h).not.toContain('/app/fleet');
  });

  it('admins see administration', () => {
    const h = hrefs(['admin']);
    expect(h).toContain('/app/admin/users');
    expect(h).toContain('/app/admin/audit');
    expect(h).toContain('/app/dispatch');
  });

  it('route guard resolves the most specific prefix', () => {
    expect(requiredPermissionsFor('/app/admin/audit')).toEqual(['audit:read']);
    expect(requiredPermissionsFor('/app/patients/abc')).toEqual(['record:read:assigned']);
    expect(requiredPermissionsFor('/app/incidents/abc')).toContain('incident:read:self');
    expect(requiredPermissionsFor('/app')).toBeUndefined();
    expect(requiredPermissionsFor('/app/profile')).toBeUndefined();
  });
});
