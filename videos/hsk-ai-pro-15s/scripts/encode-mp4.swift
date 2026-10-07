import AVFoundation
import CoreGraphics
import CoreVideo
import ImageIO
import Foundation

struct EncodeError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

func fail(_ message: String) -> Never {
    fputs("Error: \(message)\n", stderr)
    exit(1)
}

func errorDetails(_ error: Error?) -> String {
    guard let error else { return "no underlying error" }
    let nsError = error as NSError
    return "\(nsError.localizedDescription) [\(nsError.domain) \(nsError.code)] \(nsError.userInfo)"
}

let project = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let frameDirectory = project.appendingPathComponent("renders/png-frames", isDirectory: true)
let videoOnlyURL = project.appendingPathComponent("renders/hsk-ai-pro-video-only.mov")
let narrationURL = project.appendingPathComponent("renders/narration-15s.wav")
let outputURL = project.appendingPathComponent("renders/hsk-ai-pro-15s.mp4")
let width = 1080
let height = 1920
let fps: Int32 = 30
let frameCount = 450

let fileManager = FileManager.default
try? fileManager.removeItem(at: videoOnlyURL)
try? fileManager.removeItem(at: narrationURL)
try? fileManager.removeItem(at: outputURL)

let writer = try AVAssetWriter(outputURL: videoOnlyURL, fileType: .mov)
let videoSettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 8_000_000,
        AVVideoMaxKeyFrameIntervalKey: 60,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
]
let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
videoInput.expectsMediaDataInRealTime = false
let pixelAttributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: videoInput,
    sourcePixelBufferAttributes: pixelAttributes
)
guard writer.canAdd(videoInput) else { fail("Cannot add H.264 video input") }
writer.add(videoInput)
guard writer.startWriting() else { fail("Could not start video writer: \(errorDetails(writer.error))") }
writer.startSession(atSourceTime: .zero)
print("H.264 writer started")

guard let pixelBufferPool = adaptor.pixelBufferPool else { fail("Video pixel-buffer pool unavailable") }
let colorSpace = CGColorSpaceCreateDeviceRGB()
for index in 0..<frameCount {
    let frameURL = frameDirectory.appendingPathComponent(String(format: "%06d.png", index))
    guard let imageSource = CGImageSourceCreateWithURL(frameURL as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        fail("Could not read frame \(index): \(frameURL.path)")
    }
    guard image.width == width, image.height == height else {
        fail("Frame \(index) is \(image.width)x\(image.height), expected \(width)x\(height)")
    }

    var optionalBuffer: CVPixelBuffer?
    let status = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pixelBufferPool, &optionalBuffer)
    guard status == kCVReturnSuccess, let buffer = optionalBuffer else {
        fail("Could not allocate pixel buffer for frame \(index), status \(status)")
    }
    CVPixelBufferLockBaseAddress(buffer, [])
    guard let baseAddress = CVPixelBufferGetBaseAddress(buffer),
          let context = CGContext(
            data: baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: colorSpace,
            bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
          ) else {
        CVPixelBufferUnlockBaseAddress(buffer, [])
        fail("Could not create drawing context for frame \(index)")
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(buffer, [])

    while !videoInput.isReadyForMoreMediaData {
        if writer.status == .failed { fail("Video writer failed: \(errorDetails(writer.error))") }
        Thread.sleep(forTimeInterval: 0.002)
    }
    let presentationTime = CMTime(value: Int64(index), timescale: fps)
    guard adaptor.append(buffer, withPresentationTime: presentationTime) else {
        fail("Could not append frame \(index): \(errorDetails(writer.error))")
    }
    if (index + 1) % 90 == 0 { print("Encoded \(index + 1)/\(frameCount) frames") }
}

videoInput.markAsFinished()
let writerFinished = DispatchSemaphore(value: 0)
writer.finishWriting { writerFinished.signal() }
writerFinished.wait()
guard writer.status == .completed else { fail(writer.error?.localizedDescription ?? "Video writing failed") }

let wavURLs = [
    project.appendingPathComponent("assets/voiceover/segments/01.wav"),
    project.appendingPathComponent("assets/voiceover/segments/02.wav"),
    project.appendingPathComponent("assets/voiceover/segments/03.wav"),
]
var audioFormat: (channels: Int, sampleRate: Int, sampleWidth: Int)?
var audioFrames = Data()
for url in wavURLs {
    let data = try Data(contentsOf: url)
    guard data.count >= 44, String(data: data.prefix(4), encoding: .ascii) == "RIFF",
          String(data: data[8..<12], encoding: .ascii) == "WAVE" else {
        fail("Invalid PCM WAV segment: \(url.lastPathComponent)")
    }
    let channels = Int(data[22]) | (Int(data[23]) << 8)
    let sampleRate = Int(data[24]) | (Int(data[25]) << 8) | (Int(data[26]) << 16) | (Int(data[27]) << 24)
    let bitsPerSample = Int(data[34]) | (Int(data[35]) << 8)
    let headerSize = 44
    let pcm = data.subdata(in: headerSize..<data.count)
    if let audioFormat {
        guard audioFormat.channels == channels, audioFormat.sampleRate == sampleRate,
              audioFormat.sampleWidth == bitsPerSample else { fail("Voice segments use different PCM formats") }
    } else {
        audioFormat = (channels, sampleRate, bitsPerSample)
    }
    audioFrames.append(pcm)
}
guard let audioFormat, audioFormat.channels == 1, audioFormat.sampleWidth == 16 else {
    fail("Expected mono 16-bit narration audio")
}
let bytesPerSecond = audioFormat.sampleRate * audioFormat.channels * audioFormat.sampleWidth / 8
guard audioFrames.count == bytesPerSecond * 15 else {
    fail("Narration PCM is \(Double(audioFrames.count) / Double(bytesPerSecond)) seconds, expected 15")
}
var wav = Data()
func appendASCII(_ value: String) { wav.append(contentsOf: value.utf8) }
func appendLE16(_ value: UInt16) {
    wav.append(UInt8(value & 0xff)); wav.append(UInt8((value >> 8) & 0xff))
}
func appendLE32(_ value: UInt32) {
    wav.append(UInt8(value & 0xff)); wav.append(UInt8((value >> 8) & 0xff))
    wav.append(UInt8((value >> 16) & 0xff)); wav.append(UInt8((value >> 24) & 0xff))
}
appendASCII("RIFF"); appendLE32(UInt32(36 + audioFrames.count)); appendASCII("WAVE")
appendASCII("fmt "); appendLE32(16); appendLE16(1); appendLE16(UInt16(audioFormat.channels))
appendLE32(UInt32(audioFormat.sampleRate)); appendLE32(UInt32(bytesPerSecond))
appendLE16(UInt16(audioFormat.channels * audioFormat.sampleWidth / 8)); appendLE16(UInt16(audioFormat.sampleWidth))
appendASCII("data"); appendLE32(UInt32(audioFrames.count)); wav.append(audioFrames)
try wav.write(to: narrationURL, options: .atomic)

let videoAsset = AVURLAsset(url: videoOnlyURL)
let audioAsset = AVURLAsset(url: narrationURL)
guard let sourceVideoTrack = videoAsset.tracks(withMediaType: .video).first,
      let sourceAudioTrack = audioAsset.tracks(withMediaType: .audio).first else {
    fail("Encoded video or narration track is missing")
}
let composition = AVMutableComposition()
guard let compositionVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let compositionAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
    fail("Could not create MP4 composition tracks")
}
let exactDuration = CMTime(seconds: 15, preferredTimescale: 600)
try compositionVideoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: exactDuration), of: sourceVideoTrack, at: .zero)
try compositionAudioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: exactDuration), of: sourceAudioTrack, at: .zero)

guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
    fail("Could not create MP4 export session")
}
guard exporter.supportedFileTypes.contains(.mp4) else { fail("MP4 export is not supported by this macOS encoder") }
exporter.outputURL = outputURL
exporter.outputFileType = .mp4
exporter.shouldOptimizeForNetworkUse = true
let exportFinished = DispatchSemaphore(value: 0)
exporter.exportAsynchronously { exportFinished.signal() }
while exportFinished.wait(timeout: .now() + 1) == .timedOut {
    if exporter.status == .exporting {
        print(String(format: "Exporting MP4: %.0f%%", exporter.progress * 100))
    }
}
guard exporter.status == .completed else {
    fail(exporter.error?.localizedDescription ?? "MP4 export ended with status \(exporter.status.rawValue)")
}
try? fileManager.removeItem(at: videoOnlyURL)
try? fileManager.removeItem(at: narrationURL)
let outputAttributes = try fileManager.attributesOfItem(atPath: outputURL.path)
let outputSize = (outputAttributes[.size] as? NSNumber)?.intValue ?? 0
print("MP4 ready: \(outputURL.path) (\(outputSize) bytes, H.264/AAC, 1080x1920, 30 fps, 15 seconds)")
