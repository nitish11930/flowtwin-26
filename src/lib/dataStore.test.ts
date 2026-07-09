import { describe, expect, test } from 'vitest';
import { DataStore } from './dataStore';

describe('DataStore incident action workflow', () => {
  test('Assign to me updates incident owner and status', () => {
    const store = new DataStore();
    const incident = store.addIncident({
      type: 'lost_child',
      sector: 'Sector 102',
      location: 'Gate C',
      description: 'Child: Sania | Time last seen missing',
      severity: 'amber',
      missingDetails: { 'time last seen': 'missing' }
    });

    const updated = store.updateIncident(incident.id, {
      status: 'assigned',
      assignedTo: 'Sector 102 Volunteer'
    });

    expect(updated?.status).toBe('assigned');
    expect(updated?.assignedTo).toBe('Sector 102 Volunteer');
  });

  test('Mark Security Notified updates incident flag and notes', () => {
    const store = new DataStore();
    const incident = store.addIncident({
      type: 'lost_child',
      sector: 'Sector 102',
      location: 'Gate C',
      description: 'Child: Sania | Time last seen missing',
      severity: 'amber',
      missingDetails: { 'time last seen': 'missing' }
    });

    const updated = store.updateIncident(incident.id, {
      securityNotified: true,
      notes: 'Nearest usher/security guard notified.'
    });

    expect(updated?.securityNotified).toBe(true);
    expect(updated?.teamNotified).toBe(true);
    expect(updated?.notes).toContain('Nearest usher/security guard notified.');
  });

  test('Update Missing Details fills missing time last seen', () => {
    const store = new DataStore();
    const incident = store.addIncident({
      type: 'lost_child',
      sector: 'Sector 102',
      location: 'Gate C',
      description: 'Child: Sania | Time last seen missing',
      severity: 'amber',
      missingDetails: { 'time last seen': 'missing' }
    });

    const updated = store.updateIncident(incident.id, {
      missingDetails: { 'time last seen': '01:22 AM' }
    });

    expect(updated?.missingDetails?.['time last seen']).toBe('01:22 AM');
  });

  test('Duplicate open incidents are merged instead of duplicated', () => {
    const store = new DataStore();
    const first = store.addIncident({
      type: 'medical',
      sector: 'Sector 102',
      location: 'Reported via Chat',
      description: 'Medical emergency reported via Policy Assistant',
      severity: 'high'
    });

    const duplicate = store.addIncident({
      type: 'medical',
      sector: 'Sector 102',
      location: 'Reported via Chat',
      description: 'Medical emergency reported via Policy Assistant | Symptoms missing',
      severity: 'red',
      missingDetails: { symptoms: 'missing' }
    });

    const incidents = store.getIncidents();

    expect(incidents).toHaveLength(1);
    expect(duplicate.id).toBe(first.id);
    expect(duplicate.deduped).toBe(true);
    expect(incidents[0].severity).toBe('red');
    expect(incidents[0].missingDetails?.symptoms).toBe('missing');
    expect(incidents[0].timeline?.some(event => event.label === 'Duplicate report merged')).toBe(true);
  });

  test('Medical incidents support team notification, dispatch, and timeline', () => {
    const store = new DataStore();
    const incident = store.addIncident({
      type: 'medical',
      sector: 'Sector 102',
      location: 'Section 105',
      description: 'Guest fainted near Section 105',
      severity: 'red'
    });

    const teamNotified = store.updateIncident(incident.id, {
      status: 'team_notified',
      medicalTeamNotified: true,
      notes: 'Medical team notified.'
    });
    const dispatched = store.updateIncident(incident.id, {
      status: 'in_progress',
      dispatchNotified: true,
      notes: 'First-aid dispatch started.'
    });

    expect(teamNotified?.medicalTeamNotified).toBe(true);
    expect(teamNotified?.teamNotified).toBe(true);
    expect(dispatched?.status).toBe('in_progress');
    expect(dispatched?.dispatchNotified).toBe(true);
    expect(dispatched?.timeline?.map(event => event.label)).toEqual(
      expect.arrayContaining(['Medical team notified', 'First-aid dispatch started', 'Response in progress'])
    );
  });

  test('Creates mock food pickup order for fan amenity reservations', () => {
    const store = new DataStore();
    const order = store.createFoodOrder({
      amenityId: 'food-veg-215',
      amenityName: 'FIFA Fresh Veg Kitchen',
      pickupLocation: 'Concourse West near Section 214',
      items: ['vegetarian bowls', 'water'],
      pickupEtaMins: 8
    });

    expect(order.id).toContain('ord-');
    expect(order.status).toBe('reserved');
    expect(order.pickupEtaMins).toBe(8);
    expect(store.getFoodOrders()).toHaveLength(1);
  });
});
