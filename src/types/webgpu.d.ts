/**
 * Minimal WebGPU type declarations for TypeScript
 *
 * Only includes types needed for stem separation feature detection.
 * Full WebGPU types can be installed via @webgpu/types if needed.
 */

interface GPUAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
}

interface GPUAdapter {
  requestAdapterInfo(): Promise<GPUAdapterInfo>;
  requestDevice(): Promise<GPUDevice>;
  readonly features: GPUSupportedFeatures;
  readonly limits: GPUSupportedLimits;
}

interface GPUDevice {
  destroy(): void;
  readonly lost: Promise<GPUDeviceLostInfo>;
}

interface GPUDeviceLostInfo {
  readonly message: string;
  readonly reason: GPUDeviceLostReason;
}

type GPUDeviceLostReason = 'unknown' | 'destroyed';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GPUSupportedFeatures extends ReadonlySet<string> {}

interface GPUSupportedLimits {
  readonly maxTextureDimension1D: number;
  readonly maxTextureDimension2D: number;
  readonly maxTextureDimension3D: number;
  readonly maxTextureArrayLayers: number;
  readonly maxBindGroups: number;
  readonly maxBindGroupsPlusVertexBuffers: number;
  readonly maxBindingsPerBindGroup: number;
  readonly maxDynamicUniformBuffersPerPipelineLayout: number;
  readonly maxDynamicStorageBuffersPerPipelineLayout: number;
  readonly maxSampledTexturesPerShaderStage: number;
  readonly maxSamplersPerShaderStage: number;
  readonly maxStorageBuffersPerShaderStage: number;
  readonly maxStorageTexturesPerShaderStage: number;
  readonly maxUniformBuffersPerShaderStage: number;
  readonly maxUniformBufferBindingSize: number;
  readonly maxStorageBufferBindingSize: number;
  readonly minUniformBufferOffsetAlignment: number;
  readonly minStorageBufferOffsetAlignment: number;
  readonly maxVertexBuffers: number;
  readonly maxBufferSize: number;
  readonly maxVertexAttributes: number;
  readonly maxVertexBufferArrayStride: number;
  readonly maxInterStageShaderComponents: number;
  readonly maxInterStageShaderVariables: number;
  readonly maxColorAttachments: number;
  readonly maxColorAttachmentBytesPerSample: number;
  readonly maxComputeWorkgroupStorageSize: number;
  readonly maxComputeInvocationsPerWorkgroup: number;
  readonly maxComputeWorkgroupSizeX: number;
  readonly maxComputeWorkgroupSizeY: number;
  readonly maxComputeWorkgroupSizeZ: number;
  readonly maxComputeWorkgroupsPerDimension: number;
}

interface GPU {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

interface GPURequestAdapterOptions {
  powerPreference?: GPUPowerPreference;
  forceFallbackAdapter?: boolean;
}

type GPUPowerPreference = 'low-power' | 'high-performance';
type GPUTextureFormat = string;

// Extend Navigator interface
interface Navigator {
  readonly gpu: GPU;
}
