#version 300 es
precision highp float;

in vec2 a_position;

uniform float u_playhead;     // Playhead position (0-1 in track space)
uniform float u_viewStart;    // Start of visible range (0-1)
uniform float u_viewEnd;      // End of visible range (0-1)
uniform float u_lineWidth;    // Line width in clip space

void main() {
    // Calculate playhead position in view space
    float viewRange = u_viewEnd - u_viewStart;
    float normalizedX = (u_playhead - u_viewStart) / viewRange;

    // Convert to clip space (-1 to 1)
    float clipX = normalizedX * 2.0 - 1.0;

    // Add line width offset based on vertex position
    float xOffset = a_position.x * u_lineWidth;

    gl_Position = vec4(clipX + xOffset, a_position.y, 0.0, 1.0);
}
