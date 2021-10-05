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
export class SubscriptionVault {
  constructor({
    subscriptionTree={},
    onTopicAdded=()=>{},
    onTopicRemoved=()=>{}
  }) {
    this.subscriptionTree = subscriptionTree
    this.onTopicAdded = onTopicAdded
    this.onTopicRemoved = onTopicRemoved
  }

  add(topic='', subscription) {
    const topicPath = this.topicToPath(topic)

    //traverse tree down topic path, adding missing nodes, add subscription to leaf node
    this.traverse({
      topicPath,
      callback: (node, pathElement, index) => {
        const {
          children: {
            //NOTE: the parent here is not updated as node changes.
            [pathElement]: child={parent: node},
            [pathElement]: {
              subscriptions: childSubscriptions=[]
            }={},
          }={}
        } = node
        const isLastPathElement = index === topicPath.length - 1

        // Update children without losing reference
        if (!node.children) {
          node.children = {}
        }
        node.children[pathElement] = child
    
        if (isLastPathElement) {
          node.children[pathElement].subscriptions = [
            ...childSubscriptions,
            subscription
          ]

          // If this is a new topic, fire onTopicAdded
          if (childSubscriptions.length === 0) {
            //Subscribe to topic here!
            this.onTopicAdded(topic)
          }
        }
      }
    })
  }

  remove(topic='', subscription) {
    const topicPath = this.topicToPath(topic)
    let nextNode //cache current node in traverse down topicPath for starting place to clean up empty leaf nodes
    //traverse tree down topic path, remove subscription from leaf node
    //then traverse back up the tree, removing empty nodes
    //Find and remove subscription from subscriptionTree
    this.traverse({
      topicPath,
      callback: (node, pathElement, index) => {
        const {
          children={},
          children: {
            [pathElement]: child={},
            [pathElement]: {
              subscriptions: childSubscriptions=[],
            }={},
          }={},
          subscriptions=[]
        } = node
        const isLastPathElement = index === topicPath.length - 1

        if (isLastPathElement) {
          // Remove subscription from child
          //Check if subscription exists before removing
          if (childSubscriptions.includes(subscription)) {
            child.subscriptions = childSubscriptions.filter(sub => sub !== subscription)
          } else {
            console.error("could not unsubscribe, subscription not found ", {topic, subscription})
          }

          // Call onTopicRemoved callback if there are no more subscribers to the topic
          if (child?.subscriptions?.length === 0) {
            // Unsubscribe from topic here!
            this.onTopicRemoved(topic)
          }
        }

        nextNode = child
      }
    })

    //Walk back up subscriptionTree, removing empty leaf nodes.
    this.traverse({
      topicPath: topicPath.reverse(),
      initialNode: nextNode,
      reverseDirection: true,
      callback: (node, pathElement, index) => {
        const {
          parent={children: {}},
          children={},
          subscriptions=[]
        } = node
        const hasChildren = Object.keys(children).length > 0
        const hasSubscriptions = subscriptions.length > 0

        if (!hasChildren && !hasSubscriptions) {
          delete parent.children[pathElement]
        }
      }
    })
  }

  //Given a topic string, find and return all matching subscriptions
  findMatches(topic) {
    const topicPath = this.topicToPath(topic)
    return this.findMatchesByPath(topicPath)
  }

  findMatchesByPath(topicPath, initialNode=this.subscriptionTree) {
    let matchingSubscriptions = []
    // Handle '+'' & '#'' wildcards
    this.traverse({
      topicPath,
      initialNode,
      callback: (node, pathElement, index) => {

        if (!node) return
        const {
          children={},
          children: {
            '#': {
              subscriptions: multiLevelSubs=[]
            }={},
            '+': singleLevel,
            [pathElement]: childNode,
            [pathElement]: {
              subscriptions: nodeSubscriptions=[]
            }={}
          }={}
        } = node
        const isLastPathElement = index === topicPath.length - 1

        //check multi level wildcards, but not if the wildcard is defined in the topic being matched
        if (multiLevelSubs.length > 0 && pathElement !== '#') {
          matchingSubscriptions = [
            ...matchingSubscriptions,
            ...multiLevelSubs
          ]
        }

        //check single level wildcards, but not if the wildcard is defined in the topic being matched
        if (singleLevel && pathElement !== '+') {
          // recurse down wild card path
          const subTopicPath = topicPath.slice(index + 1)
          const wildcardMatches = this.findMatchesByPath(subTopicPath, singleLevel)

          matchingSubscriptions = [
            ...matchingSubscriptions,
            ...wildcardMatches
          ]
        }

        // add exact matches to topic being matched
        if (isLastPathElement) {
          matchingSubscriptions = [
            ...matchingSubscriptions,
            ...nodeSubscriptions
          ]
        }
      }
    })

    return matchingSubscriptions
  }

  reset() {
    this.subscriptionTree = {}
  }

  // Util to convert topic string to array path
  topicToPath(topic='') {
    return topic.split('/')
  }

  // Util too traverse tree down topicPath array, call callback on each node
  traverse({
    topicPath=[],
    callback=()=>{},
    initialNode=this.subscriptionTree,
    reverseDirection=false
  }) {
    let node = initialNode
    topicPath.forEach((pathElement, index) => {
      //stop traverse if node is undefined
      if (!node) return
      callback(node, pathElement, index)
      // Step down to child node to continue DFS traverse down tree to remove subscription
      //Unless reverseDirection is true, then traverse up parents
      node = reverseDirection
        ? node.parent
        : node.children[pathElement]
    })
  }
}
