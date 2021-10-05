// save subscriptions in tree structure
// expose add, remove, findMatch methods
//set of subscriberNode subscriptions

//Example of subscription topic:
// status/${accountId}/collections/+/things/+/actions/#

// onTopicAdded  - callback called when new topic is added to vault
// onTopicRemoved - callback called when old topics no longer have subscribers and are removed from vault
//   Used for subscribing to external client topics
//   Only called once per topic, even if there are multiple subscribers


/**
 * @class
 * @name SubscriptionVault
 * @classdesc Saves mqtt subscriptions in a tree structure by topic path.
 *   Example of message topic:
 *     status/myAccountId/collections/myCollection/things/myThingId/actions/myActionName
 *   Exposes these methods: add, remove, findMatches, reset
 * @param {function} onTopicAdded - callback called when new topic is added to vault
 * @param {function} onTopicRemoved - callback called when old topics no longer have subscribers and are removed from vault
 * @example of subscriptionTree:
    {
      children: {
        status: {
          children: {
            myAccountId: {
              children: {
                collections: {
                  children: {
                    '#': {
                      subscriptions: [callbackRef]
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
 */