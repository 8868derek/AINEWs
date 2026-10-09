import SwiftUI
import UIKit

struct ShareCardView: View {
    let item: NewsItem

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 10) {
                Text("简")
                    .font(.system(size: 16, weight: .semibold, design: .serif))
                    .foregroundStyle(Palette.cinnabar)
                    .frame(width: 32, height: 32)
                    .background(Palette.paper)
                VStack(alignment: .leading, spacing: 2) {
                    Text("团队 AI 简报")
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                    Text(stamp)
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.paper.opacity(0.82))
                }
                Spacer(minLength: 8)
                Text(categoryLabel(item.category))
                    .font(.system(size: 12, weight: .semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .overlay {
                        Capsule().stroke(Palette.paper.opacity(0.7), lineWidth: 1)
                    }
            }
            .foregroundStyle(Palette.paper)
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.cinnabar)

            Text(item.title)
                .font(.system(size: 26, weight: .semibold, design: .serif))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 22)
                .padding(.horizontal, 22)

            if let summary = item.summary, !summary.isEmpty {
                Text(summary)
                    .font(.system(size: 16))
                    .foregroundStyle(Palette.ink.opacity(0.86))
                    .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
                .padding(.horizontal, 22)
            }

            if let reason = item.reason, !reason.isEmpty {
                HStack(alignment: .top, spacing: 10) {
                    Rectangle()
                        .fill(Palette.moss)
                        .frame(width: 3)
                    Text(reason)
                        .font(.system(size: 15))
                        .foregroundStyle(Palette.moss)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 16)
                .padding(.horizontal, 22)
            }

            HStack {
                Text(item.source.name)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Palette.ink.opacity(0.7))
                Spacer()
                Text("AIHOT 精选")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.ink.opacity(0.4))
            }
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 22)
        }
        .frame(width: 390, alignment: .leading)
        .background(Palette.paper)
    }

    private var stamp: String {
        shanghaiStamp(item.discoveredAt)
    }
}

enum ShareCard {
    @MainActor
    static func image(for item: NewsItem) -> UIImage {
        let renderer = ImageRenderer(content: ShareCardView(item: item))
        renderer.scale = 3
        return renderer.uiImage ?? UIImage()
    }
}

struct ShareHost: UIViewControllerRepresentable {
    let item: NewsItem
    let onFinish: () -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        let host = UIViewController()
        host.view.isHidden = true
        return host
    }

    func updateUIViewController(_ host: UIViewController, context: Context) {
        guard context.coordinator.started == false else { return }
        context.coordinator.started = true
        let image = ShareCard.image(for: item)
        DispatchQueue.main.async {
            guard let top = foregroundPresenter() else {
                onFinish()
                return
            }
            let controller = UIActivityViewController(activityItems: [image], applicationActivities: nil)
            controller.excludedActivityTypes = [.assignToContact, .addToReadingList, .markupAsPDF]
            controller.completionWithItemsHandler = { _, _, _, _ in
                onFinish()
            }
            top.present(controller, animated: true)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var started = false
    }
}

private func foregroundPresenter() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    let window = scene?.windows.first { $0.isKeyWindow } ?? scene?.windows.first
    var top = window?.rootViewController
    while let next = top?.presentedViewController { top = next }
    return top
}
