import Foundation
import UserNotifications
import FirebaseMessaging
import FirebaseFirestore
import FirebaseAuth
import FirebaseFunctions

class NotificationManager: NSObject, ObservableObject, MessagingDelegate, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    
    @Published var notifications: [Notification] = []
    @Published var unreadCount: Int = 0
    @Published var currentFCMToken: String?
    
    private var db: Firestore?
    
    override init() {
        super.init()
    }
    
    func initialize() {
        // Initialize Firestore
        self.db = Firestore.firestore()
        
        // Set up FCM
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        
        // Get the current FCM token if it exists
        Messaging.messaging().token { [weak self] token, error in
            if let error = error {
                print("Error fetching FCM token: \(error.localizedDescription)")
                return
            }
            if let token = token {
                print("✉️ Current FCM token: \(token)")
                self?.currentFCMToken = token
                self?.saveFCMToken(token)
            }
        }
    }
    
    private func saveFCMToken(_ token: String) {
        guard let userId = Auth.auth().currentUser?.uid,
              let db = self.db else {
            print("❌ Cannot save FCM token: No user logged in or Firestore not initialized")
            return
        }
        
        // First, check if the token is different from what's stored
        db.collection("users").document(userId).getDocument { [weak self] snapshot, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ Error checking existing FCM token: \(error.localizedDescription)")
                return
            }
            
            let existingToken = snapshot?.data()?["fcmToken"] as? String
            
            if existingToken != token {
                // Token is different, update it
                db.collection("users").document(userId).updateData([
                    "fcmToken": token
                ]) { error in
                    if let error = error {
                        print("❌ Error saving FCM token: \(error.localizedDescription)")
                    } else {
                        print("✅ FCM token updated successfully for user: \(userId)")
                        print("📱 New FCM token: \(token)")
                    }
                }
            } else {
                print("ℹ️ FCM token unchanged for user: \(userId)")
            }
        }
    }
    
    // MARK: - MessagingDelegate
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("✉️ Firebase registration token updated: \(String(describing: fcmToken))")
        
        if let token = fcmToken {
            currentFCMToken = token
            saveFCMToken(token)
        } else {
            print("⚠️ Received nil FCM token")
        }
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .badge, .sound])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        print("Received notification response: \(userInfo)")
        completionHandler()
    }
    
    // Create notification and send push notification
    func createNotification(title: String, body: String, type: Notification.NotificationType, relatedId: String?, userId: String) {
        guard let db = self.db else { return }
        
        // First, create the notification in Firestore
        let notification = Notification(
            title: title,
            body: body,
            type: type,
            relatedId: relatedId,
            userId: userId
        )
        
        // Get the user's FCM token
        db.collection("users").document(userId).getDocument { [weak self] document, error in
            guard let self = self else { return }
            
            if let error = error {
                print("Error fetching user data: \(error.localizedDescription)")
                return
            }
            
            if let fcmToken = document?.data()?["fcmToken"] as? String {
                // Create FCM message
                let fcmMessage: [String: Any] = [
                    "message": [
                        "token": fcmToken,
                        "notification": [
                            "title": title,
                            "body": body
                        ],
                        "data": [
                            "type": type.rawValue,
                            "relatedId": relatedId ?? "",
                            "notificationId": notification.id
                        ],
                        "android": [
                            "priority": "high",
                            "notification": [
                                "sound": "default",
                                "priority": "high",
                                "channel_id": "default"
                            ]
                        ],
                        "apns": [
                            "payload": [
                                "aps": [
                                    "sound": "default",
                                    "badge": 1,
                                    "content-available": 1
                                ]
                            ]
                        ]
                    ]
                ]
                
                // Send FCM notification
                self.sendFCMNotification(fcmMessage)
            }
            
            // Save notification to Firestore
            db.collection("notifications").document(notification.id).setData(notification.dictionary) { error in
                if let error = error {
                    print("Error creating notification: \(error.localizedDescription)")
                } else {
                    // If the notification is for the current user, update the local list
                    if userId == Auth.auth().currentUser?.uid {
                        DispatchQueue.main.async {
                            self.notifications.insert(notification, at: 0)
                            self.unreadCount += 1
                            
                            // Update badge count
                            UIApplication.shared.applicationIconBadgeNumber = self.unreadCount
                        }
                    }
                }
            }
        }
    }
    
    private func sendFCMNotification(_ message: [String: Any]) {
        guard let messageData = message["message"] as? [String: Any],
              let token = messageData["token"] as? String,
              let notification = messageData["notification"] as? [String: Any],
              let data = messageData["data"] as? [String: String] else {
            print("❌ Invalid FCM message format")
            return
        }
        
        // Instead of sending directly, we'll call our Cloud Function
        let functions = Functions.functions()
        
        let payload: [String: Any] = [
            "token": token,
            "notification": notification,
            "data": data,
            "apns": [
                "payload": [
                    "aps": [
                        "sound": "default",
                        "badge": 1,
                        "content-available": 1
                    ]
                ]
            ]
        ]
        
        functions.httpsCallable("sendNotification").call(payload) { [weak self] result, error in
            if let error = error {
                print("❌ Error sending FCM notification: \(error.localizedDescription)")
                print("❌ Error details: \(error)")
            } else {
                print("✅ FCM notification sent successfully")
                if let resultData = result?.data {
                    print("✅ Result: \(resultData)")
                }
            }
        }
    }
    
    // Task-specific notification methods
    func notifyTaskAssigned(task: Task) {
        guard let assignedTo = task.assignedTo else { return }
        
        createNotification(
            title: "Tugasan Baru Ditetapkan",
            body: "Anda telah ditetapkan untuk tugasan '\(task.name)'",
            type: .newTask,
            relatedId: task.id,
            userId: assignedTo
        )
    }
    
    func notifyTaskSubmitted(task: Task) {
        createNotification(
            title: "Tugasan Diserahkan",
            body: "Tugasan '\(task.name)' telah diserahkan untuk semakan",
            type: .taskSubmitted,
            relatedId: task.id,
            userId: task.createdBy
        )
    }
    
    func notifyTaskNeedsRevision(task: Task) {
        guard let assignedTo = task.assignedTo else { return }
        
        createNotification(
            title: "Tugasan Perlu Pembetulan",
            body: "Tugasan '\(task.name)' memerlukan pembetulan",
            type: .taskNeedsRevision,
            relatedId: task.id,
            userId: assignedTo
        )
    }
    
    func notifyTaskCompleted(task: Task) {
        guard let assignedTo = task.assignedTo else { return }
        
        createNotification(
            title: "Tugasan Selesai",
            body: "Tugasan '\(task.name)' telah selesai",
            type: .taskCompleted,
            relatedId: task.id,
            userId: assignedTo
        )
        
        // Also notify the task creator
        createNotification(
            title: "Tugasan Selesai",
            body: "Tugasan '\(task.name)' telah selesai",
            type: .taskCompleted,
            relatedId: task.id,
            userId: task.createdBy
        )
    }
    
    // MARK: - Task Notifications
    func notifyNewTaskAvailable(task: Task, toUsers userIds: [String]) {
        for userId in userIds {
            createNotification(
                title: "Tugasan Baru Tersedia",
                body: "Tugasan baru '\(task.name)' telah ditambah yang sesuai dengan kemahiran anda",
                type: .newTask,
                relatedId: task.id,
                userId: userId
            )
        }
    }
    
    // MARK: - Notification Management
    func loadNotifications(for userId: String) {
        guard let db = self.db else { return }
        
        db.collection("notifications")
            .whereField("userId", isEqualTo: userId)
            .order(by: "createdAt", descending: true)
            .addSnapshotListener { [weak self] querySnapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("Error loading notifications: \(error.localizedDescription)")
                    return
                }
                
                guard let documents = querySnapshot?.documents else { return }
                
                DispatchQueue.main.async {
                    self.notifications = documents.compactMap { document in
                        Notification.from(document)
                    }
                    
                    self.unreadCount = self.notifications.filter { !$0.isRead }.count
                    
                    // Update badge count
                    UIApplication.shared.applicationIconBadgeNumber = self.unreadCount
                }
            }
    }
    
    func requestPermission(completion: @escaping (Bool) -> Void) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if granted {
                print("✅ Notification permission granted")
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } else {
                print("❌ Notification permission denied")
                if let error = error {
                    print("Error requesting notification permission: \(error.localizedDescription)")
                }
            }
            completion(granted)
        }
    }
    
    func setupFCM() {
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
    }
    
    func markAsRead(_ notificationId: String, userId: String) {
        guard let db = self.db else { return }
        
        db.collection("notifications").document(notificationId).updateData([
            "isRead": true
        ]) { [weak self] error in
            if let error = error {
                print("Error marking notification as read: \(error.localizedDescription)")
            } else {
                // Update local unread count
                if let index = self?.notifications.firstIndex(where: { $0.id == notificationId }) {
                    self?.notifications[index].isRead = true
                    self?.unreadCount = self?.notifications.filter { !$0.isRead }.count ?? 0
                    
                    // Update badge count
                    DispatchQueue.main.async {
                        UIApplication.shared.applicationIconBadgeNumber = self?.unreadCount ?? 0
                    }
                }
            }
        }
    }
    
    func markAllAsRead(userId: String) {
        guard let db = self.db else { return }
        
        let batch = db.batch()
        
        notifications.filter { !$0.isRead }.forEach { notification in
            let ref = db.collection("notifications").document(notification.id)
            batch.updateData(["isRead": true], forDocument: ref)
        }
        
        batch.commit { [weak self] error in
            if let error = error {
                print("Error marking all notifications as read: \(error.localizedDescription)")
            } else {
                // Update local notifications
                self?.notifications = self?.notifications.map { notification in
                    var updatedNotification = notification
                    updatedNotification.isRead = true
                    return updatedNotification
                } ?? []
                self?.unreadCount = 0
                
                // Update badge count
                DispatchQueue.main.async {
                    UIApplication.shared.applicationIconBadgeNumber = 0
                }
            }
        }
    }
} 