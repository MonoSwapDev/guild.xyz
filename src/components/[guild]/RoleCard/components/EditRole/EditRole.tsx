import {
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerOverlay,
  FormLabel,
  HStack,
  Icon,
  IconButton,
  useDisclosure,
  VStack,
} from "@chakra-ui/react"
import useGuild from "components/[guild]/hooks/useGuild"
import RolePlatforms from "components/[guild]/RolePlatforms"
import SetVisibility from "components/[guild]/SetVisibility"
import { usePostHogContext } from "components/_app/PostHogProvider"
import Button from "components/common/Button"
import DiscardAlert from "components/common/DiscardAlert"
import DrawerHeader from "components/common/DrawerHeader"
import OnboardingMarker from "components/common/OnboardingMarker"
import Section from "components/common/Section"
import Description from "components/create-guild/Description"
import DynamicDevTool from "components/create-guild/DynamicDevTool"
import IconSelector from "components/create-guild/IconSelector"
import Name from "components/create-guild/Name"
import SetRequirements from "components/create-guild/Requirements"
import { AnimatePresence, motion } from "framer-motion"
import usePinata from "hooks/usePinata"
import useSubmitWithUpload from "hooks/useSubmitWithUpload"
import useToast from "hooks/useToast"
import useWarnIfUnsavedChanges from "hooks/useWarnIfUnsavedChanges"
import { ArrowLeft, Check, PencilSimple } from "phosphor-react"
import { useEffect, useRef } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { Logic, Requirement, RolePlatform, Visibility } from "types"
import getRandomInt from "utils/getRandomInt"
import handleSubmitDirty from "utils/handleSubmitDirty"
import mapRequirements from "utils/mapRequirements"
import DeleteRoleButton from "./components/DeleteRoleButton"
import RoleGroupSelect from "./components/RoleGroupSelect"
import useEditRole from "./hooks/useEditRole"

type Props = {
  roleId: number
}

export type RoleEditFormData = {
  id: number
  name: string
  description: string
  imageUrl: string
  logic: Logic
  requirements: Requirement[]
  rolePlatforms: RolePlatform[]
  visibility: Visibility
  anyOfNum?: number
  groupId?: number
}

const MotionDrawerFooter = motion(DrawerFooter)
// Footer is 76px high
const FOOTER_OFFSET = 76

const EditRole = ({ roleId }: Props): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const btnRef = useRef()
  const { captureEvent } = usePostHogContext()

  const { roles } = useGuild()
  const {
    id,
    name,
    description,
    imageUrl,
    logic,
    anyOfNum,
    requirements,
    rolePlatforms,
    visibility,
    groupId,
  } = roles?.find((role) => role.id === roleId) ?? {}

  const defaultValues: RoleEditFormData = {
    id,
    name,
    description,
    imageUrl,
    logic,
    anyOfNum: anyOfNum ?? 1,
    requirements: mapRequirements(requirements),
    rolePlatforms: rolePlatforms ?? [],
    visibility,
    groupId,
  }
  const methods = useForm<RoleEditFormData>({
    mode: "all",
    defaultValues,
  })

  useEffect(() => {
    const role = roles?.find((r) => r.id === roleId)
    if (!role) return

    methods.reset({
      ...role,
      requirements: mapRequirements(role.requirements),
      rolePlatforms: role.rolePlatforms ?? [],
      anyOfNum: role.anyOfNum ?? 1,
    })
  }, [roles, roleId])

  const handleOpen = () => {
    onOpen()
    // needed for correct remove platform behavior after adding new platform -> saving -> opening edit again
    methods.setValue("rolePlatforms", rolePlatforms ?? [])
  }

  const toast = useToast()

  const onSuccess = () => {
    toast({
      title: `Role successfully updated!`,
      status: "success",
    })
    onClose()
    methods.reset(undefined, { keepValues: true })
  }

  const { onSubmit, isLoading, isSigning, signLoadingText } = useEditRole(
    id,
    onSuccess
  )

  /**
   * TODO: for some reason, isDirty was true & dirtyFields was an empty object and I
   * couldn't find the underlying problem, so used this workaround here, but we
   * should definitely find out what causes this strange behaviour!
   */
  const isDirty = Object.values(methods.formState.dirtyFields).length > 0
  useWarnIfUnsavedChanges(isDirty && !methods.formState.isSubmitted)

  const {
    isOpen: isAlertOpen,
    onOpen: onAlertOpen,
    onClose: onAlertClose,
  } = useDisclosure()

  const onCloseAndClear = () => {
    methods.reset(defaultValues)
    onAlertClose()
    onClose()
  }

  const iconUploader = usePinata({
    onSuccess: ({ IpfsHash }) => {
      methods.setValue(
        "imageUrl",
        `${process.env.NEXT_PUBLIC_IPFS_GATEWAY}${IpfsHash}`,
        {
          shouldTouch: true,
          shouldDirty: true,
        }
      )
    },
    onError: () => {
      methods.setValue("imageUrl", `/guildLogos/${getRandomInt(286)}.svg`, {
        shouldTouch: true,
      })
    },
  })

  const drawerBodyRef = useRef<HTMLDivElement>()
  const { handleSubmit, isUploadingShown, uploadLoadingText } = useSubmitWithUpload(
    handleSubmitDirty(methods)(onSubmit, (formErrors) => {
      if (formErrors.requirements && drawerBodyRef.current) {
        drawerBodyRef.current.scrollBy({
          top: drawerBodyRef.current.scrollHeight,
          behavior: "smooth",
        })
      }
    }),

    iconUploader.isUploading
  )

  const loadingText = signLoadingText || uploadLoadingText || "Saving data"

  return (
    <>
      <OnboardingMarker
        step={3}
        onClick={() => {
          captureEvent("guild creation flow > pulse marker: Edit role clicked")
          handleOpen()
        }}
      >
        <IconButton
          ref={btnRef}
          icon={<Icon as={PencilSimple} />}
          size="sm"
          rounded="full"
          aria-label="Edit role"
          onClick={handleOpen}
        />
      </OnboardingMarker>

      <Drawer
        isOpen={isOpen}
        placement="left"
        size={{ base: "full", md: "lg" }}
        onClose={isDirty ? onAlertOpen : onClose}
        finalFocusRef={btnRef}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerBody ref={drawerBodyRef} className="custom-scrollbar" pb={24}>
            <FormProvider {...methods}>
              <DrawerHeader
                title="Edit role"
                justifyContent="start"
                spacing={1}
                alignItems="center"
                w="full"
                leftElement={
                  <IconButton
                    aria-label="Back"
                    icon={<Icon as={ArrowLeft} boxSize="1.1em" weight="bold" />}
                    display={{ base: "flex", md: "none" }}
                    borderRadius="full"
                    maxW={10}
                    maxH={10}
                    mr={2}
                    onClick={onCloseAndClear}
                  >
                    Cancel
                  </IconButton>
                }
              >
                <HStack justifyContent={"space-between"} flexGrow={1}>
                  <SetVisibility entityType="role" />
                  {roles?.length > 1 && (
                    <DeleteRoleButton roleId={id} onDrawerClose={onClose} />
                  )}
                </HStack>
              </DrawerHeader>
              <VStack spacing={10} alignItems="start">
                <RolePlatforms roleId={roleId} />
                <Section title="General">
                  <Box>
                    <FormLabel>Logo and name</FormLabel>
                    <HStack spacing={2} alignItems="start">
                      <IconSelector uploader={iconUploader} />
                      <Name />
                    </HStack>
                  </Box>
                  <Description />
                  <RoleGroupSelect />
                </Section>

                <SetRequirements />
              </VStack>
            </FormProvider>
          </DrawerBody>

          <AnimatePresence>
            {(isDirty || iconUploader.isUploading) && (
              <MotionDrawerFooter
                initial={{ y: FOOTER_OFFSET, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: FOOTER_OFFSET, opacity: 0 }}
                transition={{ duration: 0.3 }}
                position="absolute"
                w="full"
                bottom="0"
              >
                <Button variant="outline" mr={3} onClick={onCloseAndClear}>
                  Cancel
                </Button>
                <Button
                  isLoading={isLoading || isSigning || isUploadingShown}
                  colorScheme="green"
                  loadingText={loadingText}
                  onClick={handleSubmit}
                  leftIcon={<Icon as={Check} />}
                  data-test="save-role-button"
                >
                  Save
                </Button>
              </MotionDrawerFooter>
            )}
          </AnimatePresence>
        </DrawerContent>
        <DynamicDevTool control={methods.control} />
      </Drawer>

      <DiscardAlert
        isOpen={isAlertOpen}
        onClose={onAlertClose}
        onDiscard={onCloseAndClear}
      />
    </>
  )
}

const EditRoleWrapper = ({ roleId }) => {
  const { isDetailed } = useGuild()
  if (!isDetailed)
    return (
      <OnboardingMarker step={3}>
        <IconButton size="sm" rounded="full" aria-label="Edit role" isLoading />
      </OnboardingMarker>
    )

  return <EditRole roleId={roleId} />
}

export default EditRoleWrapper
