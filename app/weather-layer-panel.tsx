"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_WEATHER_LAYERS,
  loadWeatherLayerState,
  saveWeatherLayerState,
  WEATHER_LAYER_META,
  type WeatherLayerId,
  type WeatherLayerState,
} from "./weather-layers";

export function WeatherLayerPanel({
  value,
  onChange,
}: {
  value?: WeatherLayerState;
  onChange?: (state: WeatherLayerState) => void;
}) {
  const [layers, setLayers] = useState<WeatherLayerState>(value || DEFAULT_WEATHER_LAYERS);

  useEffect(() => {
    if (!value) setLayers(loadWeatherLayerState());
  }, [value]);

  function toggle(id: WeatherLayerId) {
    const next = { ...layers, [id]: !layers[id] };
    setLayers(next);
    saveWeatherLayerState(next);
    onChange?.(next);
  }

  return (
    <div
      aria-label="Weather layers"
      style={{
        width: 250,
        padding: 12,
        borderRadius: 16,
        border: "1px solid rgba(142,171,218,.18)",
        background: "rgba(7,14,27,.88)",
        backdropFilter: "blur(18px)",
        boxShadow: "0 18px 50px rgba(0,0,0,.28)",
        color: "#edf5ff",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.1, color: "#8397b7", marginBottom: 8 }}>
        WEATHER LAYERS
      </div>

      {WEATHER_LAYER_META.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => toggle(item.id)}
          aria-pressed={layers[item.id]}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "9px 4px",
            border: 0,
            borderBottom: "1px solid rgba(142,171,218,.09)",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span>
            <strong style={{ display: "block", fontSize: 12.5 }}>{item.label}</strong>
            <small style={{ color: "#7f91ab", fontSize: 9.5 }}>{item.description}</small>
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 34,
              height: 20,
              padding: 2,
              borderRadius: 999,
              background: layers[item.id] ? "rgba(66,125,255,.85)" : "rgba(111,128,154,.25)",
              transition: "background .18s ease",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: "block",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                transform: layers[item.id] ? "translateX(14px)" : "translateX(0)",
                transition: "transform .18s ease",
                boxShadow: "0 2px 7px rgba(0,0,0,.25)",
              }}
            />
          </span>
        </button>
      ))}
    </div>
  );
}
