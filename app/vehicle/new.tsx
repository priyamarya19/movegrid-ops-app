import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipSelect, DateField, TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { ImageField } from '@/components/ui/ImageField';
import { useToast } from '@/components/ui/Toast';
import { colors, space } from '@/constants/theme';
import { createVehicle, getHubs, type Hub } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/useApiQuery';

const OEMS = ['Shelby', 'NXTE', 'E-sprinto'].map((o) => ({ label: o, value: o }));
const IOT_PARTNERS = ['Fixx ev/Loconav', 'Roadcast'].map((o) => ({ label: o, value: o }));
const BATTERY_PARTNERS = ['Battery Smart', 'Sun Mobility', 'Yuma', 'Mooving'].map((o) => ({ label: o, value: o }));

export default function NewVehicleScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const fetchHubs = useCallback((t: string) => getHubs(t), []);
  const { data: hubs } = useApiQuery<Hub[]>(fetchHubs, [], { cacheKey: 'hubs' });

  const [ev, setEv] = useState('');
  const [oem, setOem] = useState<string | null>(null);
  const [hubId, setHubId] = useState<string | null>(null);
  const [chassis, setChassis] = useState('');
  const [motor, setMotor] = useState('');
  const [controller, setController] = useState('');
  const [iotImei, setIotImei] = useState('');
  const [iotPartner, setIotPartner] = useState<string | null>(null);
  const [batteryNumber, setBatteryNumber] = useState('');
  const [batteryPartner, setBatteryPartner] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [price, setPrice] = useState('');
  const [photo, setPhoto] = useState('');
  const [rcBook, setRcBook] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = ev.trim().length > 0 && !!oem && chassis.trim().length > 0 && !submitting;

  const onSubmit = async () => {
    if (!token || !canSubmit || !oem) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await createVehicle(token, {
        ev_number: ev.trim(),
        oem,
        chassis_number: chassis.trim(),
        motor_number: motor.trim() || null,
        controller_number: controller.trim() || null,
        iot_imei: iotImei.trim() || null,
        iot_partner: iotPartner,
        battery_number: batteryNumber.trim() || null,
        battery_partner: batteryPartner,
        hub_id: hubId,
        purchase_date: purchaseDate || null,
        price: price.trim() ? Number(price) : null,
        vehicle_photo_url: photo || null,
        rc_book_url: rcBook || null,
      });
      toast(`Vehicle ${res.ev_number} added`, 'success');
      router.replace({ pathname: '/vehicle/[id]', params: { id: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const hubOptions = (hubs ?? []).map((h) => ({ label: h.hub_name, value: h.id }));

  return (
    <>
      <Stack.Screen options={{ title: 'Add vehicle' }} />
      <FormScreen>
        <Text style={styles.section}>Identity</Text>
        <TextField label="EV / scooter number" required value={ev} onChangeText={setEv} placeholder="e.g. MG0426N0051" autoCapitalize="characters" editable={!submitting} />
        <ChipSelect label="OEM / Assembler" options={OEMS} value={oem} onChange={setOem} />
        {hubOptions.length > 0 ? <ChipSelect label="Hub" options={hubOptions} value={hubId} onChange={setHubId} /> : null}

        <Text style={styles.section}>Hardware numbers</Text>
        <TextField label="Chassis number" required value={chassis} onChangeText={setChassis} placeholder="Chassis number" autoCapitalize="characters" editable={!submitting} />
        <TextField label="Motor number" value={motor} onChangeText={setMotor} placeholder="Optional" autoCapitalize="characters" editable={!submitting} />
        <TextField label="Controller number" value={controller} onChangeText={setController} placeholder="Optional" autoCapitalize="characters" editable={!submitting} />

        <Text style={styles.section}>IOT</Text>
        <TextField label="IOT / IMEI number" value={iotImei} onChangeText={setIotImei} placeholder="Optional" editable={!submitting} />
        <ChipSelect label="IOT partner" options={IOT_PARTNERS} value={iotPartner} onChange={setIotPartner} />

        <Text style={styles.section}>Battery</Text>
        <TextField label="Battery number" value={batteryNumber} onChangeText={setBatteryNumber} placeholder="Optional" autoCapitalize="characters" editable={!submitting} />
        <ChipSelect label="Battery partner" options={BATTERY_PARTNERS} value={batteryPartner} onChange={setBatteryPartner} />

        <Text style={styles.section}>Purchase</Text>
        <DateField label="Purchase date" value={purchaseDate || new Date().toISOString().split('T')[0]} onChange={setPurchaseDate} />
        <TextField label="Purchase price (₹)" value={price} onChangeText={setPrice} placeholder="0" keyboardType="numeric" editable={!submitting} />

        <Text style={styles.section}>Documents</Text>
        <ImageField label="Vehicle photo" folder="vehicles" value={photo} onChange={setPhoto} />
        <ImageField label="RC book" folder="vehicles" value={rcBook} onChange={setRcBook} />

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Add vehicle" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: space(2),
  },
});
