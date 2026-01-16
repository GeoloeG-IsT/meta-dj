#version 300 es
precision highp float;

out vec4 fragColor;

const vec3 ENGINE_GREEN = vec3(0.302, 0.98, 0.565); // #4DFA90

void main() {
    fragColor = vec4(ENGINE_GREEN, 1.0);
}
