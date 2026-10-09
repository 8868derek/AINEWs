import SwiftUI

@main
struct AINEWsApp: App {
    @State private var store = NewsStore()

    var body: some Scene {
        WindowGroup {
            ContentView(store: store)
        }
    }
}
