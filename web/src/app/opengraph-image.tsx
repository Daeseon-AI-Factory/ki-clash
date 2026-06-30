import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "JJAN! Ki Clash official game page";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #10121f 0%, #0b0b14 48%, #171019 100%)",
          color: "white",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 98,
            background: "#facc15",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "122px 0 auto 0",
            height: 2,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 70,
            bottom: 70,
            width: 270,
            height: 270,
            border: "28px solid rgba(34, 211, 238, 0.72)",
            transform: "rotate(12deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 78,
            bottom: 70,
            width: 270,
            height: 270,
            border: "28px solid rgba(244, 114, 182, 0.72)",
            transform: "rotate(-12deg)",
          }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "52px",
          }}
        >
          <div
            style={{
              border: "2px solid rgba(250, 204, 21, 0.5)",
              borderRadius: 999,
              padding: "12px 24px",
              color: "#fde68a",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 5,
              textTransform: "uppercase",
              background: "rgba(0,0,0,0.38)",
            }}
          >
            Real-time ki reveal duel
          </div>
          <div
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "baseline",
              fontSize: 150,
              lineHeight: 0.86,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            JJAN<span style={{ color: "#fde047" }}>!</span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 38,
              lineHeight: 1.2,
              fontWeight: 800,
              color: "rgba(255,255,255,0.88)",
            }}
          >
            Read, charge, strike.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
