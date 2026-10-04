import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DOC_TYPES, LANDLINE_PREFIXES, MOBILE_PREFIXES, joinDoc, joinPhone, splitDoc, splitPhone } from '@/lib/venezuela';

interface BaseProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Clases del campo de texto (alto, fondo...) para igualar el formulario donde se usa */
  inputClassName?: string;
  'aria-invalid'?: boolean;
}

/**
 * Teléfono venezolano: desplegable de prefijos (móviles y fijos) + 7 dígitos.
 * Entrega siempre "+58XXXXXXXXXX" (o '' si no hay número), el formato que valida la base.
 */
export function PhoneInput({ id, value, onChange, required, disabled, className, inputClassName, ...rest }: BaseProps) {
  const [prefix, setPrefix] = useState(() => splitPhone(value).prefix);
  const [number, setNumber] = useState(() => splitPhone(value).number);

  // Sincroniza si el valor cambia desde fuera (p. ej. al cargar el perfil)
  useEffect(() => {
    if (value !== joinPhone(prefix, number)) {
      const s = splitPhone(value);
      setPrefix(s.prefix);
      setNumber(s.number);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = number.length > 3 ? `${number.slice(0, 3)} ${number.slice(3)}` : number;

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={prefix}
        disabled={disabled}
        onValueChange={p => { setPrefix(p); onChange(joinPhone(p, number)); }}
      >
        <SelectTrigger className={cn('w-[104px] shrink-0 tabular-nums', inputClassName)} aria-label="Prefijo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectGroup>
            <SelectLabel>Móvil</SelectLabel>
            {MOBILE_PREFIXES.map(p => <SelectItem key={p} value={p} className="tabular-nums">{p}</SelectItem>)}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Fijo</SelectLabel>
            {LANDLINE_PREFIXES.map(p => <SelectItem key={p} value={p} className="tabular-nums">{p}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="123 4567"
        value={display}
        required={required}
        disabled={disabled}
        onChange={e => {
          const n = e.target.value.replace(/\D/g, '').slice(0, 7);
          setNumber(n);
          onChange(joinPhone(prefix, n));
        }}
        className={cn('min-w-0 flex-1 tabular-nums', inputClassName)}
        aria-invalid={rest['aria-invalid']}
      />
    </div>
  );
}

/**
 * Cédula o RIF: desplegable V / E / J / G / P + número.
 * Entrega "V-12345678" (o '' si no hay número).
 */
export function DocumentIdInput({ id, value, onChange, required, disabled, className, inputClassName, ...rest }: BaseProps) {
  const [type, setType] = useState(() => splitDoc(value).type as string);
  const [number, setNumber] = useState(() => splitDoc(value).number);

  useEffect(() => {
    if (value !== joinDoc(type, number)) {
      const s = splitDoc(value);
      setType(s.type);
      setNumber(s.number);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn('flex gap-2', className)}>
      <Select value={type} disabled={disabled} onValueChange={t => { setType(t); onChange(joinDoc(t, number)); }}>
        <SelectTrigger className={cn('w-[72px] shrink-0 font-semibold', inputClassName)} aria-label="Tipo de documento">
          <SelectValue>{type}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DOC_TYPES.map(d => (
            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        inputMode="numeric"
        placeholder={type === 'J' || type === 'G' ? '123456789' : '12345678'}
        value={number}
        required={required}
        disabled={disabled}
        onChange={e => {
          const n = e.target.value.replace(/\D/g, '').slice(0, 10);
          setNumber(n);
          onChange(joinDoc(type, n));
        }}
        className={cn('min-w-0 flex-1 tabular-nums', inputClassName)}
        aria-invalid={rest['aria-invalid']}
      />
    </div>
  );
}
