#version 300 es
precision highp float;

in vec3 v_color;
in float v_peak;
in float v_normalizedX;

// Note: u_playhead, u_viewStart, u_viewEnd removed - playhead is drawn by separate shader
uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
    // Base color from vertex shader
    vec3 color = v_color;

    // Apply subtle gradient for depth
    float gradientFactor = 1.0 - (gl_FragCoord.y / u_resolution.y) * 0.2;
    color *= gradientFactor;

    // Apply slight glow effect at peaks
    float glowIntensity = smoothstep(0.7, 1.0, v_peak);
    color = mix(color, color * 1.3, glowIntensity);

    // Output with full opacity
    fragColor = vec4(color, 1.0);
}
