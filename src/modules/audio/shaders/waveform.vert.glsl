#version 300 es
precision highp float;

// Instanced attributes (per bar)
in float a_position;      // X position (0-1 normalized)
in float a_lowPeak;       // Low frequency peak (0-1)
in float a_midPeak;       // Mid frequency peak (0-1)
in float a_highPeak;      // High frequency peak (0-1)

// Per-vertex attributes (quad corners)
in vec2 a_corner;         // -1 to 1 for each corner of the bar

// Uniforms
uniform vec2 u_resolution;    // Canvas size in pixels
uniform float u_barWidth;     // Width of each bar in normalized coords
uniform float u_viewStart;    // Start of visible range (0-1)
uniform float u_viewEnd;      // End of visible range (0-1)
uniform float u_playhead;     // Current playhead position (0-1)
uniform int u_colorMode;      // 0=RGB, 1=Blue, 2=3Band

// Output to fragment shader
out vec3 v_color;
out float v_peak;
out float v_normalizedX;

// Color constants
const vec3 COLOR_LOW_RGB = vec3(1.0, 0.231, 0.188);   // #FF3B30
const vec3 COLOR_MID_RGB = vec3(0.302, 0.98, 0.565);  // #4DFA90
const vec3 COLOR_HIGH_RGB = vec3(0.18, 0.549, 1.0);   // #2E8CFF

const vec3 COLOR_BLUE_LOW = vec3(0.118, 0.565, 1.0);
const vec3 COLOR_BLUE_MID = vec3(0.18, 0.549, 1.0);
const vec3 COLOR_BLUE_HIGH = vec3(0.529, 0.808, 0.922);

void main() {
    // Calculate visible range
    float viewRange = u_viewEnd - u_viewStart;

    // Transform position from track-space to view-space
    float normalizedX = (a_position - u_viewStart) / viewRange;

    // Skip bars outside visible range
    if (normalizedX < -0.1 || normalizedX > 1.1) {
        gl_Position = vec4(2.0, 2.0, 0.0, 1.0); // Off-screen
        return;
    }

    // Compute total peak and color based on mode
    float totalPeak;
    vec3 barColor;

    if (u_colorMode == 0) {
        // RGB mode: blend colors by frequency contribution
        float totalEnergy = a_lowPeak + a_midPeak + a_highPeak;
        if (totalEnergy > 0.001) {
            barColor = (COLOR_LOW_RGB * a_lowPeak +
                        COLOR_MID_RGB * a_midPeak +
                        COLOR_HIGH_RGB * a_highPeak) / totalEnergy;
        } else {
            barColor = vec3(0.1, 0.1, 0.1);
        }
        totalPeak = max(max(a_lowPeak, a_midPeak), a_highPeak);
    } else if (u_colorMode == 1) {
        // Blue mode: single color
        barColor = COLOR_BLUE_MID;
        totalPeak = (a_lowPeak + a_midPeak + a_highPeak) / 3.0;
    } else {
        // 3-Band mode: stacked (handled specially in fragment shader)
        // Use corner.y to determine which band to show
        if (a_corner.y < -0.33) {
            barColor = COLOR_LOW_RGB;
            totalPeak = a_lowPeak;
        } else if (a_corner.y < 0.33) {
            barColor = COLOR_MID_RGB;
            totalPeak = a_midPeak;
        } else {
            barColor = COLOR_HIGH_RGB;
            totalPeak = a_highPeak;
        }
    }

    // Convert to clip space (-1 to 1)
    float x = normalizedX * 2.0 - 1.0;

    // Calculate bar geometry
    float barHalfWidth = u_barWidth / viewRange;
    float barHeight = totalPeak * 0.9; // Leave small margin

    // Apply corner offset
    float finalX = x + a_corner.x * barHalfWidth;
    float finalY = a_corner.y * barHeight;

    gl_Position = vec4(finalX, finalY, 0.0, 1.0);
    v_color = barColor;
    v_peak = totalPeak;
    v_normalizedX = normalizedX;
}
