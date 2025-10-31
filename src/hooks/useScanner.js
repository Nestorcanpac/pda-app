import { useEffect, useRef } from "react";

/**
 * Detecta lecturas de escáner en modo teclado (HID) por la velocidad de tecleo.
 * - Acumula caracteres hasta encontrar Enter/Tab.
 * - Si el intervalo entre teclas es menor a thresholdMs, se considera escaneo.
 * - Llama a onScan(payload) con el valor leído.
 */
export function useScanner(onScan, options = {}) {
  const thresholdMs = options.thresholdMs ?? 35; // típico escáner 5-20ms por tecla
  const bufferRef = useRef("");
  const lastTsRef = useRef(0);
  const isScanningRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      const now = Date.now();
      const delta = now - lastTsRef.current;
      lastTsRef.current = now;

      // Fin de lectura por Enter o Tab
      if (e.key === "Enter" || e.key === "Tab") {
        if (isScanningRef.current && bufferRef.current) {
          const payload = bufferRef.current;
          bufferRef.current = "";
          isScanningRef.current = false;
          if (typeof onScan === "function") onScan(payload);
          e.preventDefault();
        }
        return;
      }

      // Ignorar teclas de control
      if (e.key.length !== 1) return;

      // Determinar si es ritmo de escaneo
      if (delta < thresholdMs || bufferRef.current.length === 0) {
        isScanningRef.current = true;
        bufferRef.current += e.key;
        // Evitar que el buffer caiga en inputs si estamos capturando
        // (solo si no hay foco en input/textarea)
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") e.preventDefault();
      } else {
        // Ritmo humano: resetea
        bufferRef.current = "";
        isScanningRef.current = false;
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [onScan, thresholdMs]);
}

