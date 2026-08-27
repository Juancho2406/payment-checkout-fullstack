import { useEffect, useId, useState, type FormEvent } from "react";
import {
  cardLast4,
  detectCardBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isValidCardholder,
  isValidCvc,
  isValidExpiry,
  luhnOk,
} from "../../lib/card";
import { saveCardSession } from "../../lib/card-session";
import {
  isNonEmpty,
  isValidColombianPhone,
  isValidEmail,
  isValidFullName,
} from "../../lib/identity";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { BrandMark } from "./BrandMark";
import { closeCheckoutModal, saveCheckoutDraft } from "./checkoutSlice";

type FieldErrors = Record<string, string>;

export function CheckoutModal() {
  const dispatch = useAppDispatch();
  const titleId = useId();
  const savedCustomer = useAppSelector((state) => state.checkout.customer);
  const savedDelivery = useAppSelector((state) => state.checkout.delivery);
  const [fullName, setFullName] = useState(savedCustomer?.fullName ?? "");
  const [email, setEmail] = useState(savedCustomer?.email ?? "");
  const [phone, setPhone] = useState(savedCustomer?.phone ?? "");
  const [pan, setPan] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardholder, setCardholder] = useState("");
  const [address, setAddress] = useState(savedDelivery?.address ?? "");
  const [city, setCity] = useState(savedDelivery?.city ?? "");
  const [region, setRegion] = useState(savedDelivery?.region ?? "");
  const [postalCode, setPostalCode] = useState(savedDelivery?.postalCode ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});

  const brand = detectCardBrand(pan);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch(closeCheckoutModal());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    const resolvedBrand = detectCardBrand(pan);
    if (Object.keys(nextErrors).length > 0 || !resolvedBrand) {
      return;
    }
    saveCardSession({
      pan: digitsOnly(pan),
      cvc,
      expiry,
      cardholder: cardholder.trim(),
    });
    dispatch(
      saveCheckoutDraft({
        customer: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.replace(/[\s-]/g, ""),
        },
        delivery: {
          address: address.trim(),
          city: city.trim(),
          region: region.trim(),
          postalCode: postalCode.trim(),
        },
        cardPreview: {
          brand: resolvedBrand,
          last4: cardLast4(pan),
        },
      }),
    );
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!isValidFullName(fullName)) {
      next.fullName = "Nombre demasiado corto";
    }
    if (!isValidEmail(email)) {
      next.email = "Email inválido";
    }
    if (!isValidColombianPhone(phone)) {
      next.phone = "Usa un celular CO (3 + 9 dígitos)";
    }
    if (!brand) {
      next.pan = "Solo Visa o Mastercard";
    } else if (!luhnOk(pan)) {
      next.pan = "Número de tarjeta inválido";
    }
    if (!isValidExpiry(expiry)) {
      next.expiry = "Vencimiento MM/AA inválido";
    }
    if (!isValidCvc(cvc)) {
      next.cvc = "CVC de 3 dígitos";
    }
    if (!isValidCardholder(cardholder)) {
      next.cardholder = "Nombre en la tarjeta";
    }
    if (!isNonEmpty(address)) {
      next.address = "Dirección requerida";
    }
    if (!isNonEmpty(city)) {
      next.city = "Ciudad requerida";
    }
    if (!isNonEmpty(region)) {
      next.region = "Departamento requerido";
    }
    if (!isNonEmpty(postalCode)) {
      next.postalCode = "Código postal requerido";
    }
    return next;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => dispatch(closeCheckoutModal())}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId} className="modal__title">
            Pago y entrega
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={() => dispatch(closeCheckoutModal())}
          >
            ×
          </button>
        </header>
        <form className="modal__form" onSubmit={onSubmit} autoComplete="off">
          <fieldset className="fieldset fieldset--buyer">
            <legend>Comprador</legend>
            <label>
              Nombre completo
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              {errors.fullName ? <span className="field-error">{errors.fullName}</span> : null}
            </label>
            <div className="field-row field-row--stack">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                {errors.email ? <span className="field-error">{errors.email}</span> : null}
              </label>
              <label>
                Celular
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="3001112233"
                  autoComplete="tel"
                />
                {errors.phone ? <span className="field-error">{errors.phone}</span> : null}
              </label>
            </div>
          </fieldset>

          <fieldset className="fieldset fieldset--card">
            <legend>Tarjeta</legend>
            <label>
              Número
              <span className="card-input">
                <input
                  value={formatCardNumber(pan)}
                  onChange={(e) => setPan(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  data-testid="card-number"
                />
                <BrandMark brand={brand} />
              </span>
              {errors.pan ? <span className="field-error">{errors.pan}</span> : null}
            </label>
            <div className="field-row">
              <label>
                Vence
                <input
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/AA"
                  inputMode="numeric"
                  autoComplete="off"
                  data-testid="card-expiry"
                />
                {errors.expiry ? <span className="field-error">{errors.expiry}</span> : null}
              </label>
              <label>
                CVC
                <input
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  inputMode="numeric"
                  autoComplete="off"
                  data-testid="card-cvc"
                />
                {errors.cvc ? <span className="field-error">{errors.cvc}</span> : null}
              </label>
            </div>
            <label>
              Titular
              <input
                value={cardholder}
                onChange={(e) => setCardholder(e.target.value)}
                autoComplete="off"
              />
              {errors.cardholder ? <span className="field-error">{errors.cardholder}</span> : null}
            </label>
          </fieldset>

          <fieldset className="fieldset fieldset--delivery">
            <legend>Entrega</legend>
            <label>
              Dirección
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
              {errors.address ? <span className="field-error">{errors.address}</span> : null}
            </label>
            <div className="field-row field-row--delivery">
              <label>
                Ciudad
                <input value={city} onChange={(e) => setCity(e.target.value)} />
                {errors.city ? <span className="field-error">{errors.city}</span> : null}
              </label>
              <label>
                Departamento
                <input value={region} onChange={(e) => setRegion(e.target.value)} />
                {errors.region ? <span className="field-error">{errors.region}</span> : null}
              </label>
              <label>
                Código postal
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                {errors.postalCode ? <span className="field-error">{errors.postalCode}</span> : null}
              </label>
            </div>
          </fieldset>

          <button type="submit" className="button modal__submit">
            Continuar
          </button>
        </form>
      </div>
    </div>
  );
}
